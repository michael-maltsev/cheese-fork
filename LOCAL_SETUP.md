# Complete local setup

This guide runs the CheeseFork frontend on `http://localhost:8000` while using
your own live Firebase project. This is the simplest way to test real Google
sign-in, Firestore synchronization, sharing, feedback, group links, and calendar
uploads locally.

The Firebase Local Emulator Suite is not used here. Its Auth emulator can mock
users, but it does not perform the real Google OAuth flow.

## 1. Install the prerequisites

Install:

- A current version of Python 3
- Node.js and npm
- A Google account that can create a Firebase project

From the repository root, install the linting dependencies:

```powershell
npm install
```

Do not open `index.html` directly with a `file://` URL. Authentication and
browser storage require the site to be served over HTTP.

## 2. Create and register a Firebase web app

### Where configuration values are saved

This project does not use a `.env` file. It is a static site with no bundler,
build step, or backend process to read environment variables.

Save the Firebase web configuration directly in these two files:

- `cheesefork.js`, in the `config` object inside `firebaseInit()`
- `course-widget-comments.html`, in the `config` object inside
  `firebaseInit()`

Use the same Firebase configuration in both places. Values such as `apiKey`,
`authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, and `appId` are
public client configuration and will be visible to visitors. Firebase protects
data through Authentication and Security Rules, not by hiding these values.

Never place private credentials in either file, including service-account JSON,
private keys, GitHub personal access tokens, or server API secrets. Features
that require private credentials need a separate backend or serverless
function.

1. Open <https://console.firebase.google.com/>.
2. Select **Create a project** and choose a unique project ID.
3. Google Analytics is optional for local development.
4. In **Project overview**, select the Web (`</>`) icon.
5. Register an app such as `cheesefork-local`.
6. Do not enable Firebase Hosting unless you also want to deploy through it.
7. Copy the displayed `firebaseConfig` object.

A current config normally resembles:

```javascript
var config = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

Use the exact values shown by your Firebase console. New default Storage
buckets normally end in `.firebasestorage.app`; older ones may end in
`.appspot.com`. A `databaseURL` is unnecessary because this project uses Cloud
Firestore, not Firebase Realtime Database.

Firebase web configuration is public application metadata, not a server secret.
Security must be enforced with Authentication and Firebase Security Rules.

## 3. Enable sign-in methods

In Firebase Console:

1. Open **Build > Authentication**.
2. Select **Get started**.
3. Under **Sign-in method**, enable **Google**.
4. Select a project support email and save.
5. Enable **Email/Password** as well. Enable the regular email/password option,
   not email-link-only sign-in.
6. Open **Authentication > Settings > Authorized domains**.
7. Add `localhost` if it is not already present.

Firebase projects created after April 28, 2025 do not automatically authorize
`localhost`. Enter only the hostname, without `http://` or port `8000`.

If you later deploy the fork, add its hostname too, for example
`YOUR_USERNAME.github.io` or `schedule.example.com`.

## 4. Create Cloud Firestore

1. Open **Build > Firestore Database**.
2. Select **Create database**.
3. Choose a location close to the expected users. This choice is effectively
   permanent.
4. Start in **Production mode**.
5. Open the **Rules** tab, replace the default rules with the rules below, and
   select **Publish**.

```text
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    // Schedule sharing in the current application requires public reads.
    match /users/{userId} {
      allow read: if true;
      allow create, update, delete: if isOwner(userId);

      match /semesters/{semesterId} {
        allow read: if true;
        allow create, update, delete: if isOwner(userId);
      }
    }

    // Everyone may view feedback; only signed-in users may publish it.
    match /courseFeedback/{courseId} {
      allow read: if true;
      allow create, update: if isSignedIn();
      allow delete: if false;
    }

    // The existing report form does not require sign-in. Reports are private.
    match /courseFeedbackReports/{courseId} {
      allow read, delete: if false;
      allow create, update: if true;
    }

    // The UI requires sign-in both to view and update community group links.
    match /courseExtraDetails/{courseId} {
      allow read, create, update: if isSignedIn();
      allow delete: if false;
    }
  }
}
```

No collections or documents need to be created manually. The application
creates them when features are used:

- `users/{uid}/semesters/{semester}` stores current schedules.
- `users/{uid}` stores schedules only for legacy semesters 201701–201801.
- `courseFeedback/{course}` stores feedback in a `posts` array.
- `courseFeedbackReports/{course}` stores reports in a `posts` array.
- `courseExtraDetails/{course}` stores WhatsApp, Telegram, and Discord links.

These rules reproduce the current application's behavior, but two parts deserve
review before a public production launch:

- Public schedule reads make shared links work, but anyone who obtains a user
  ID can read that user's semester document, including custom events.
- The unauthenticated report endpoint can be abused. Requiring sign-in would be
  safer, but the report UI must then also be changed to enforce sign-in.

## 5. Create Cloud Storage

Cloud Storage is needed only for remotely hosted `.ics` calendar files. Normal
calendar downloads work without it.

As of February 3, 2026, Cloud Storage for Firebase requires the pay-as-you-go
Blaze plan, including use of a default bucket. Billing must therefore be enabled
to make the hosted calendar-subscription feature work. Set budget alerts in
Google Cloud before exposing the app publicly.

1. Upgrade the Firebase project to **Blaze** if prompted.
2. Open **Build > Storage** and select **Get started**.
3. Create the default bucket.
4. Keep the exact bucket name shown in the console; it must match
   `storageBucket` in your Firebase web config.
5. Open **Storage > Rules**, publish the following rules:

```text
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /{userId}/{fileName} {
      allow read: if true;

      allow create, update: if request.auth != null
        && request.auth.uid == userId
        && fileName.matches('.*[.]ics')
        && request.resource.size < 1024 * 1024;

      allow delete: if request.auth != null
        && request.auth.uid == userId;
    }
  }
}
```

Public reads are required for calendar clients, which cannot send a Firebase
login token when subscribing to an `.ics` URL.

## 6. Replace the original Firebase configuration

The fork currently connects to the original `cheesefork-de9af` project. Replace
the entire `config` object with the object copied in step 2 in both locations:

1. `cheesefork.js`, inside `firebaseInit()`
2. `course-widget-comments.html`, inside `firebaseInit()`

Both copies must use identical values. The second copy powers the standalone
course-feedback widget.

Do not copy the original project's API key or project ID into your new Firebase
project settings. Use only the values generated for your own web app.

## 7. Point calendar uploads at your bucket

The main app explicitly selects the original owner's secondary bucket:

```javascript
firebaseStorage = firebase.app().storage("gs://files.cheesefork.cf");
```

In `cheesefork.js`, change it to the default bucket from your config:

```javascript
firebaseStorage = firebase.storage();
```

The export flow also assumes that the original custom domain
`https://files.cheesefork.cf/` serves Storage objects. That domain will not
serve files from your bucket.

For a local fork, use Firebase's generated download URL:

1. Initialize `calendarUrl` to `null` rather than constructing a
   `files.cheesefork.cf` URL.
2. After `calFileRef.putString(...)` resolves, call
   `snapshot.ref.getDownloadURL()`.
3. Assign the returned URL to `calendarUrl`.
4. Create the download link and enable the copy button only after that URL has
   resolved.
5. Keep the existing error handler, or add a `.catch(...)`.

The resulting promise flow should have this shape:

```javascript
var calendarUrl = null;

calFileRef
  .putString(calendar, "raw", {
    cacheControl: "public, max-age=0",
  })
  .then(function (snapshot) {
    return snapshot.ref.getDownloadURL();
  })
  .then(function (downloadUrl) {
    calendarUrl = downloadUrl;

    var urlElement = $(
      '<a target="_blank" rel="noopener">לחצו כאן להורדה</a>',
    ).prop("href", calendarUrl);
    exportCalendarDialog
      .getModalBody()
      .find(".calendar-link-placeholder")
      .html(urlElement);
    exportCalendarDialog.getButton("copy-link").enable();
  })
  .catch(function (error) {
    alert("Error saving calendar to server: " + error.message);
  });
```

Keep the copy button disabled while `calendarUrl` is `null`.

## 8. Review non-Firebase production references

The following external services can remain unchanged for local development,
provided they are online:

- `ug.cheesefork.cf` and `sap.cheesefork.cf` supply semester course catalogs.
- `michael-maltsev.github.io/technion-calendar-events` supplies holidays.
- `michael-maltsev.github.io/technion-histograms` supplies histogram data.
- `michael-maltsev.github.io/technion-course-names` supplies course names.

They are not part of your Firebase project. An internet connection is required.
If their owners remove them or block access, the corresponding feature will
stop working and you will need to host replacement datasets.

The repository also contains production references that are unnecessary
locally:

- `CNAME` claims `cheesefork.cf`; remove or replace it before enabling GitHub
  Pages on your fork.
- Google Analytics uses the original `UA-115440973-1` property. Remove those
  script blocks or replace them with your own analytics setup before deployment.
- `share-histograms.html` loads its bookmarklet from `cheesefork.cf`; replace
  that URL if you intend to own and operate the histogram contribution flow.

### Secure the histogram contribution flow

`share-histograms.js` currently decodes several credentials in
`getGithubToken()` and sends them in `Authorization` headers to the GitHub API.
It also writes directly to
`michael-maltsev/technion-histograms`. Base64 encoding does not protect a
credential: every visitor can recover it from the browser source.

Do not replace those values with your own GitHub personal access token. A
browser-only static site cannot safely hold a repository write credential.

For local development, disable or avoid the histogram contribution bookmarklet;
histogram viewing still works without it. To operate contribution uploads
safely in production:

1. Fork or create the histogram data repository.
2. Remove all embedded tokens from the client code. Treat any previously
   published token as compromised and revoke it in the account that issued it.
3. Create a small authenticated backend endpoint, such as a serverless function
   or GitHub App, that owns the repository credential.
4. Validate the course, semester, category, file type, and maximum payload size
   on that backend.
5. Add rate limiting and abuse protection.
6. Update `submitToGithub()` to call your endpoint without receiving or
   exposing the repository credential.
7. Update the hard-coded `michael-maltsev/technion-histograms` read and write
   URLs to your repository and deployment.

Deleting credentials in a new commit does not remove them from existing Git
history, which is why revocation is required.

## 9. Start the local site

From the repository root, run:

```powershell
python -m http.server 8000
```

Open:

<http://localhost:8000>

Use `localhost`, not `127.0.0.1`, unless you also add `127.0.0.1` as an
authorized Firebase Authentication domain.

## 10. Verify every backend feature

Use this order so failures are easy to isolate:

1. Open DevTools and confirm there are no failed Firebase scripts.
2. Select **Sign in**, then sign in with Google.
3. Refresh the page and confirm the session remains signed in.
4. Add a course and select a lecture or tutorial.
5. In Firestore, confirm a document appears at
   `users/{your-uid}/semesters/{current-semester}`.
6. Open the site in a second tab and confirm schedule changes synchronize.
7. Generate a share URL and open it in a private browser window. Confirm the
   read-only schedule loads while signed out.
8. Publish course feedback and confirm `courseFeedback/{course}` is created.
9. Open a course group-link dialog, add a test link, and confirm
   `courseExtraDetails/{course}` is created.
10. Submit a feedback report and confirm
    `courseFeedbackReports/{course}` is created. Its contents should not be
    readable by the browser afterward.
11. Export a non-empty calendar. Confirm the `.ics` object appears in Storage
    under `{your-uid}/` and its generated URL downloads successfully.
12. Sign out and confirm the schedule falls back to browser `localStorage`.

Run the linter after making the code changes:

```powershell
npx eslint .
```

## 11. Troubleshooting

### `auth/unauthorized-domain`

Add `localhost` to **Authentication > Settings > Authorized domains**. Do not
include a protocol or port.

### Google popup closes or is blocked

Allow popups for `http://localhost:8000`, disable strict popup-blocking
extensions temporarily, and inspect the browser console for the Firebase error
code.

### `auth/operation-not-allowed`

Enable the relevant provider under **Authentication > Sign-in method**.

### `Missing or insufficient permissions`

Publish the Firestore rules from step 4, confirm the user is signed in, and
verify that both Firebase config copies point to the same project.

### `storage/unauthorized`

Publish the Storage rules from step 5 and ensure the first path segment is the
signed-in user's Firebase UID.

### `storage/no-default-bucket`

Create the default Storage bucket and copy its exact name into the
`storageBucket` config field.

### `storage/quota-exceeded`

Confirm that the project is on the Blaze plan and that billing is active.

### Sign-in works but feedback does not

Check the separate Firebase config in `course-widget-comments.html`, then check
the `courseFeedback` Firestore rules.

### The app says `Failed to load courses`

This is not a Firebase error. Confirm internet access and inspect the request to
the selected `ug.cheesefork.cf` or `sap.cheesefork.cf` catalog in the Network
panel.

### Firestore works but the copied calendar URL does not

The app is probably still constructing a `files.cheesefork.cf` URL. Complete
step 7 and use `snapshot.ref.getDownloadURL()` instead.
