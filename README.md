# CheeseFork

![logo](logo.png)

CheeseFork is a Hebrew, right-to-left web application for building Technion
semester schedules. It combines the official course catalog with an interactive
weekly calendar, advanced course filters, schedule sharing, calendar export,
grade histograms, and community course feedback.

The application is available at [cheesefork.cf](https://cheesefork.cf).

## Features

- Search for courses by number or name and filter them by faculty, academic
  framework, credit points, prerequisites, linked courses, and exam dates.
- Build a weekly schedule by selecting lecture, tutorial, laboratory, and
  project groups.
- Detect overlapping lessons and preview course groups directly on the
  timetable.
- Add custom calendar events and use undo/redo while editing a schedule.
- Save schedules locally without an account or synchronize them through
  Firebase after signing in.
- Share a read-only schedule using a generated URL.
- Export lessons, exams, and semester events to an iCalendar (`.ics`) file.
  Signed-in users can also create a remotely hosted calendar subscription.
- Review changes made to course details after the official catalog is updated.
- Browse community-contributed grade histograms and course feedback.
- Access course group links shared by the community.
- Use dark mode, print-friendly styles, and a guided first-run tour.

## How it works

CheeseFork is a static, build-free application. The browser loads the relevant
semester catalog, creates a `CourseManager`, and passes the normalized course
data to the search, selected-course, exam, and calendar components.

```text
Semester course catalog
        |
        v
  CourseManager
        |
        +--> CourseSelect
        +--> CourseButtonList
        +--> CourseCalendar
        +--> CourseExamInfo
        |
        +--> localStorage (anonymous users)
        +--> Firebase Auth + Firestore (signed-in users)
        +--> Firebase Storage (hosted iCalendar files)
```

Course catalogs are loaded at runtime from CheeseFork's external semester data
services. Holiday and semester event data, grade histograms, feedback, and
community links are fetched from their respective external sources as needed.
Because the application has no bundling step, scripts and styles are loaded
directly by `index.html`.

## Technology stack

### Frontend

- HTML5 and CSS3 with a Hebrew RTL layout
- Vanilla JavaScript written for ES5 compatibility
- Bootstrap 4 RTL for layout and common UI elements
- jQuery for DOM manipulation and event handling
- FullCalendar 3 for the interactive weekly timetable
- Moment.js for date and time handling
- Selectize for searchable course selection
- Intro.js for the onboarding tour
- Font Awesome for icons
- `ics.js` for iCalendar generation
- JsDiff for displaying course metadata changes

Third-party browser dependencies are vendored in `modules/`; the project does
not use a frontend package manager, bundler, or transpiler at runtime.

### Backend and data services

- Firebase Authentication for Google and email sign-in
- Cloud Firestore for user schedules, course feedback, reports, and community
  course details
- Firebase Storage for hosted `.ics` calendar subscriptions
- External CheeseFork course catalogs for semester data
- The `technion-calendar-events` data set for holidays and semester dates
- The `technion-histograms` project for community grade distributions

Firebase's client configuration is intentionally present in the browser code,
as is standard for Firebase web applications. Access control must therefore be
enforced by Firebase Security Rules rather than by treating that configuration
as a secret.

### Tooling and automation

- ESLint with `eslint-plugin-compat`
- Python 3 and `requests` for semester metadata maintenance
- GitHub Actions for the scheduled semester update workflow
- Static hosting configuration for GitHub Pages and Netlify

## Repository structure

```text
.
|-- index.html                    Main application document and script loader
|-- cheesefork.js                 Application initialization, auth, persistence,
|                                 sharing, export, and navigation
|-- course-manager.js             Course model, parsing, links, and prerequisites
|-- cheesefork.css                Main application styles
|-- cheesefork-dark.css           Dark-mode styles
|-- cheesefork-print.css          Print-specific styles
|-- components/
|   |-- course-select/            Course search and advanced filters
|   |-- course-button-list/       Selected courses and course details
|   |-- course-calendar/          Interactive FullCalendar timetable
|   |-- course-exam-info/         Exam date display
|   |-- course-feedback/          Community course feedback
|   `-- histogram-browser/        Grade histogram viewer
|-- modules/                      Vendored third-party browser libraries
|-- ci/
|   `-- semester_update.py        Updates semester metadata in index.html
|-- .github/workflows/
|   `-- deploy.yml                Scheduled and manual semester update workflow
|-- share-histograms.html         Histogram contribution instructions
|-- share-histograms.js           Histogram sharing bookmarklet
|-- course-widget-*.html          Embeddable histogram and feedback widgets
|-- assets/                       Guide images and alternate visual assets
|-- icons/                        Favicons, PWA icons, and web manifest
|-- netlify.toml                  Netlify response headers
|-- CNAME                         Custom domain for static hosting
`-- .nojekyll                     GitHub Pages static-file configuration
```

Each component directory contains the JavaScript and CSS for one UI area.
`cheesefork.js` coordinates these components and owns cross-cutting behavior;
course normalization and course-specific logic live in `course-manager.js`.

## Local development

Follow the [complete local setup guide](LOCAL_SETUP.md) to configure the local
server, Firebase Authentication, Firestore, Storage, Security Rules, and all
required fork-specific settings.

## Code quality

Run the linter from the repository root:

```bash
npx eslint .
```

Application JavaScript is linted as ES5 browser code. Keep global strict mode,
four-space indentation, semicolons, and compatibility with the configured
browser target. Vendored modules and generated/minified scripts are excluded
from linting.

The repository currently has no automated test suite. The `npm test` script is
a placeholder and exits with an error, so changes should be linted and tested
manually in the affected user flows.

## Persistence and sharing

Anonymous schedules are stored in `localStorage` under semester-specific keys.
After a user signs in, CheeseFork listens to that user's semester document in
Firestore and synchronizes course selections, group choices, metadata, and
custom events in real time.

Shared schedule URLs include a semester and Firebase user ID. Opening one of
these links loads the owner's schedule in read-only mode. Do not place private
information in custom events intended for a shared schedule.

## Semester data maintenance

Available-semester metadata is embedded in `index.html`. The
`ci/semester_update.py` script retrieves current semester information and
updates that metadata when necessary.

The `Run semester update` GitHub Actions workflow:

1. Runs every day at 09:00 UTC and can also be started manually.
2. Installs Python and the `requests` dependency.
3. Runs `python -u ./ci/semester_update.py`.
4. Commits and pushes `index.html` when the semester list changes.

The course catalog files themselves are maintained by separate CheeseFork data
services and are selected at runtime according to the requested semester.

## Deployment

CheeseFork can be deployed by publishing the repository root to any static
host; no build output directory is required.

- `.nojekyll` keeps GitHub Pages from processing the site with Jekyll.
- `CNAME` configures the `cheesefork.cf` custom domain.
- `netlify.toml` applies the deployment's response headers.
- The application manifest and icons are located in `icons/`.

Before deploying a fork, replace or review the custom domain, Firebase project,
external service URLs, analytics configuration, and corresponding Firebase
Security Rules.

## Known constraints

- The application is designed specifically for Technion course and semester
  formats; it is not a generic scheduling engine.
- Most of the UI and course content are in Hebrew.
- Complete operation depends on external course catalogs and community data
  sources being available.
- The codebase intentionally targets ES5/IE 11 compatibility and uses legacy
  versions of several browser libraries.
- Dependencies in `modules/` are checked into the repository and are not
  automatically updated by `npm install`.
- Authentication, shared schedules, feedback, and hosted calendar exports
  require a correctly configured Firebase project.

## Contributing

1. Create a branch for the change.
2. Keep course-domain logic in `course-manager.js` and UI-specific logic in the
   relevant component directory.
3. Preserve the build-free ES5 architecture and RTL behavior unless the change
   explicitly introduces a broader migration.
4. Run `npx eslint .`.
5. Manually verify the affected flows in at least one desktop and one
   mobile-sized viewport.
6. Open a pull request describing the behavior changed and how it was tested.

When adding or replacing a third-party browser dependency, include its license,
verify browser compatibility, and document why the vendored file is needed.

A scheduling helper web application for Technion students.

## License

CheeseFork is distributed under the
[GNU General Public License v3.0](LICENSE).
