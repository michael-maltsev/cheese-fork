# CheeseFork Privacy Policy

Last updated: 2026-09-22

CheeseFork (https://cheesefork.cf) is a free, open source schedule builder for Technion students. This policy describes what data the site handles, where it goes, and how you can control it. The full source code is available at https://github.com/michael-maltsev/cheese-fork, so everything described here can be verified.

CheeseFork is a static website. There is no CheeseFork-operated server that processes your data. All storage and authentication is handled by third-party services (mainly Google Firebase) directly from your browser, as described below.

## Summary

- You can use CheeseFork without an account. Your schedule is then stored only in your browser.
- Signing in is optional. It enables syncing your schedule across devices, sharing it with a link, a hosted iCalendar link, and posting course feedback.
- The site uses Google Analytics.
- Course feedback you post is public. Schedules and iCalendar files you share are visible to anyone who has the link.
- Histogram sharing uploads only aggregate course statistics to a public GitHub repository, never your own grades or identity.

## 1. Using CheeseFork without an account

When you are not signed in, the schedule you build (selected courses, chosen lesson groups, and custom events) is stored in your browser's local storage, per semester. It is not sent to any server.

The site also stores small preference values in local storage, such as:

- the last semester you viewed;
- whether you dismissed the intro tour, tips, and reminder popups (course feedback, weekly graph, histogram sharing, Technion scans);
- the display name you last used when posting course feedback;
- your light/dark mode choice.

This data stays on your device until you clear the site's data in your browser.

## 2. Signing in

Authentication is provided by Firebase Authentication (Google). You can sign in with a Google account or with an email address and password. When you sign in, Firebase provides CheeseFork with your user ID, email address, and display name (and, for Google sign-in, your profile picture URL). CheeseFork does not use Facebook or any other social sign-in.

When you are signed in, CheeseFork stores your display name in its database so that it can be shown to people you share your schedule with (see section 4). Your email address is not stored by CheeseFork outside of Firebase Authentication itself.

Firebase Authentication keeps your session in your browser (local storage or IndexedDB) so you stay signed in between visits. Signing out clears it.

## 3. Schedule data stored in the cloud

When you are signed in, your schedule is stored in Google Cloud Firestore in a document tied to your user ID and the semester, instead of in local storage. It contains:

- the list of courses you selected and their order;
- the lesson groups you chose for each course;
- custom events you added (title, day, time, and any other fields you fill in);
- a snapshot of the catalog data for your selected courses, used to detect and show changes made to the course catalog after you built your schedule;
- your display name.

This data is used only to render your schedule, keep it in sync across your devices, and power the features described in this policy. Removing a course or a custom event removes it from the cloud document.

## 4. Sharing your schedule

The "Share schedule" feature creates a link that contains your user ID. Anyone who has the link can view your schedule for that semester in real time, together with your display name. Viewing a shared schedule does not require signing in.

Please share the link only with people you want to see your schedule. Anyone who has it can keep viewing your schedule as long as it exists; there is no separate way to revoke a link other than clearing the schedule for that semester.

## 5. iCalendar export

If you are not signed in, the iCalendar (.ics) file is generated in your browser and downloaded directly. Nothing is uploaded.

If you are signed in, the file is uploaded to Firebase Cloud Storage and made available at a fixed public URL under https://files.cheesefork.cf/ that is derived from your user ID and the semester. This lets you subscribe to the link from a calendar application, and the file is overwritten each time you open the export dialog. The file contains your lessons, your exam dates, and your custom events. Anyone who has the URL can download it.

## 6. Course feedback

You can read course feedback (reviews) without signing in. Posting feedback requires signing in.

When you post feedback, the following is stored in Cloud Firestore and shown publicly to all CheeseFork users, including through the embeddable feedback widget: the author name you type in the form (which may be anything you choose, and is not your account name), the semester, the review text, the workload and overall ratings, and the time of posting. As stated in the posting form, feedback is displayed anonymously, but your account identity is retained for moderation purposes. Feedback that violates the posting guidelines may be removed.

When you report a post as inappropriate, the email address and reason you enter, together with the reported post's text, author name, and timestamp, are stored in Cloud Firestore. Reports are visible only to the CheeseFork maintainers and are used to review the reported content and, if needed, to follow up with you.

## 7. Sharing histograms

CheeseFork shows grade histograms collected from the Technion grades website. You can contribute histograms by running a script (share-histograms.js) on https://grades.technion.ac.il/, either via a bookmarklet or via the Technion Plus Plus browser extension. This only happens when you explicitly start it.

The script runs inside your own session on the Technion grades website and reads the course pages available to you. For each course it extracts only aggregate, non-personal information: the number of students, pass/fail counts, pass percentage, minimum, maximum, average, median, the list of course staff, and the histogram image itself. Your own grades, name, ID number, or any other personal details are not read or uploaded.

The extracted data is sent from your browser directly to the GitHub API and committed to the public repository https://github.com/michael-maltsev/technion-histograms using CheeseFork's own GitHub credentials, so the contribution is not attributed to you or your GitHub account. Nothing is uploaded until you click the share button in the script's interface.

## 8. Analytics

CheeseFork uses Google Analytics on the main site and on the embeddable feedback and histogram widgets. Google Analytics collects information such as the pages you visit, your browser and device type, approximate location derived from your IP address, and interaction events (for example, which navigation buttons or popup options were clicked). Google Analytics sets cookies in your browser for this purpose.

CheeseFork does not send your name, email, user ID, or schedule contents to Google Analytics. You can block Google Analytics with a content blocker or with Google's opt-out browser add-on. Google's own privacy policy is available at https://policies.google.com/privacy.

## 9. Third-party services and content

Using CheeseFork causes your browser to contact the following services. Each of them receives standard connection information such as your IP address and browser details, and is governed by its own privacy policy.

- **Google Firebase** (Authentication, Cloud Firestore, Cloud Storage) and Firebase SDKs loaded from www.gstatic.com. Privacy policy: https://firebase.google.com/support/privacy.
- **Google Analytics**, loaded from www.googletagmanager.com. See section 8.
- **Course catalog and data files** loaded from ug.cheesefork.cf, sap.cheesefork.cf, and michael-maltsev.github.io (hosted on GitHub Pages). These contain only public course information, histograms, and calendar data; no user data is sent to them beyond the request itself.
- **Facebook Page plugin**. The "weekly graph" popup embeds the CheeseFork Facebook page in an iframe served by Facebook. Facebook may set cookies and collect data when that popup is displayed, according to Facebook's privacy policy. The plugin is only loaded when the popup is shown, and you can disable the popup from within it.
- **Hosting**. The site itself is served by GitHub Pages, which may keep standard server access logs.

The site also contains links to external sites and communities (Technion websites, Technion scans, WhatsApp, Telegram, Discord, Facebook groups, the Chrome Web Store). Following a link takes you to a site with its own policy, and CheeseFork does not share your data with them.

## 10. Cookies and browser storage

CheeseFork itself does not set cookies. It uses local storage for the data described in section 1, and Firebase Authentication uses local storage or IndexedDB to keep you signed in. Google Analytics and the Facebook Page plugin may set their own cookies as described above.

## 11. Retention and deletion

- Data in your browser is kept until you clear the site's data in your browser settings.
- Cloud schedule data is kept for as long as your account exists. You can remove individual courses and custom events from within the app.
- Public course feedback is kept indefinitely unless removed by moderation or at your request.
- Contributed histograms are part of a public repository and are kept indefinitely; they contain no personal data.

To request deletion of your account, your cloud schedule data, feedback you posted, or a hosted iCalendar file, contact the maintainer as described in section 14. Please include the email address or display name of the account so the data can be located.

## 12. Security

All communication with the services above is over HTTPS. Your cloud schedule data can only be modified from your browser while you are signed in to your account. Data that you choose to make available through a link (a shared schedule or a hosted iCalendar file) is readable by anyone who has that link, and course feedback is public by design.

## 13. Changes to this policy

This policy may be updated when the site's features change. The date at the top indicates the latest revision, and the history is available in the project's Git repository.

## 14. Contact

CheeseFork is developed and maintained by Michael Maltsev. For privacy questions or data deletion requests, send a message to the CheeseFork Facebook page at https://www.facebook.com/cheesefork.technion or open an issue at https://github.com/michael-maltsev/cheese-fork/issues.
