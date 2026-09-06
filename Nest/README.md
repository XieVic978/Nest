# Nest

## Page file map

Each screen is intentionally bare so one teammate can build it without touching the others.

| Page | File |
| --- | --- |
| Login | `src/app/(auth)/sign-in.tsx` |
| Profile setup | `src/app/profile-setup.tsx` |
| Create / join a home | `src/app/create-join.tsx` |
| Nest — center tab / announcements home | `src/app/(room)/index.tsx` |
| Payments / what is owed | `src/app/(room)/payments.tsx` |
| Chores | `src/app/(room)/chores.tsx` |
| Groceries | `src/app/(room)/groceries.tsx` |
| Documents and 4-digit PIN entry | `src/app/(room)/documents.tsx` |
| Profile — outside the bottom tabs | `src/app/profile.tsx` |
| Authenticated bottom-tab navigation | `src/app/(room)/_layout.tsx` |
| App-level navigation | `src/app/_layout.tsx` |

Protected routes send signed-out users to Login and new users to Profile Setup.
After completing their profile, users without a room see Create / Join, while
room members enter the authenticated tab area. The tab order is Chores,
Payments, Nest, Groceries, Documents.

## Nest room setup

The room flow uses the authenticated Supabase session. Add these values to a
local `.env.local` file (see `.env.example`):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Apply the migrations in `supabase/migrations` to the same Supabase project used
by authentication. They create profiles, rooms, memberships, 10-minute
invitations, transactional RPCs, and Row Level Security policies.

`20260905020000_create_shared_nest_data.sql` adds persistent chores and
announcements. Run it after the room migrations. It also enables Supabase
Realtime for those tables, keeps announcement read/dismiss state per user, and
limits every query and write to authenticated members of the matching Nest.

`20260905030000_create_shared_groceries.sql` adds the shared grocery list. Run
it after `20260905020000_create_shared_nest_data.sql`. Grocery additions,
edits, purchase status, restores, and deletions then update every signed-in
member of the same Nest through Supabase Realtime.

`20260905040000_fix_legacy_rooms_join_code.sql` repairs projects whose existing
`rooms` table still requires the old `join_code` column. The current invite
system uses `room_invites`, so this compatibility migration keeps the legacy
column but makes it optional. Run it if creating a Nest reports a null
`join_code` constraint error.

`20260905050000_add_leave_nest.sql` adds the transactional leave flow. It
automatically promotes the earliest-joined remaining member when an admin
leaves, revokes that admin's active invitations, and deletes the Nest and all
of its shared data when its final member leaves. It also applies those same
rules when a user confirms that they want to switch to a different Nest.

`20260905060000_allow_member_invites.sql` allows every current Nest member to
view, share, and regenerate the room's shared 10-minute invitation. It keeps
invite access isolated to the matching Nest and broadcasts regenerated invites
to the other members through Supabase Realtime.

The authentication flow stores the display name in `profiles.full_name`, with
the authenticated user ID as `profiles.id`. Email sign-in links return through
`auth/callback`; first-time users are then routed to Profile Setup. In Supabase
Authentication > URL Configuration, allow `nest://**` for development/standalone
builds and temporarily allow `exp://**` when testing callbacks in Expo Go. A
pending `nest://join/<token>` invitation is kept through sign-in and profile
setup.

All future shared-data tables must have a non-null `room_id`. Their Row Level
Security policies should authorize access with
`private.is_nest_member(room_id)` so filtering cannot be bypassed by a modified
client.

## Run the app

```bash
npm install
npm start
```

Scan the QR code with Expo Go. To test in a browser instead, press `w` after Expo starts.

---

# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
