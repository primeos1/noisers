import type { ReactNode } from "react";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";

const EMAIL = "noisersfootball@gmail.com";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-2xl uppercase text-paper">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-paper-dim">{children}</div>
    </div>
  );
}

// Linked from the app stores and the Noisers FC app; keep it in step with
// what the site and app actually collect.
export default function Privacy() {
  return (
    <Layout>
      <PageHeader eyebrow="Noisers FC" title="Privacy policy" />
      <section className="bg-ink">
        <div className="mx-auto max-w-3xl space-y-10 px-5 py-10 md:px-10 md:py-16">
          <p className="text-sm text-mist">Last updated 1 November 2026</p>

          <Section title="Who we are">
            <p>
              Noisers FC is a five-a-side football club in Lekki, Lagos. This policy covers the noisersfc.com website and
              the Noisers FC mobile app. Questions go to{" "}
              <a href={`mailto:${EMAIL}`} className="text-paper underline underline-offset-4">
                {EMAIL}
              </a>
              .
            </p>
          </Section>

          <Section title="What we collect">
            <p>
              <strong className="text-paper">Squad members.</strong> When you join the squad or edit your profile we
              keep your name, shirt number, positions, an optional bio and photo, and, if you give them, your phone number
              and email address. The committee also records your match results, goals, assists, cards, ratings and
              absences.
            </p>
            <p>
              <strong className="text-paper">Committee members.</strong> Staff accounts hold a name, email address and a
              hashed password.
            </p>
            <p>
              <strong className="text-paper">On your device.</strong> The app keeps the squad passcode or your sign-in
              token in the phone's secure storage so you stay signed in. Photos are only read when you choose one to
              upload. Motion sensors are used on the device to tilt player cards and nothing from them leaves the phone.
            </p>
          </Section>

          <Section title="How we use it">
            <p>
              We use this information to run the club: picking teams, recording match days, fines and awards, and
              contacting players. Names, photos, positions and match statistics are shown publicly on the website and in
              the app. Phone numbers and email addresses are only visible to the committee.
            </p>
            <p>
              We don't sell your information, show adverts, or track you across other apps and websites. There are no
              third-party analytics or advertising tools in the app.
            </p>
          </Section>

          <Section title="Where it's stored">
            <p>
              The club's data is stored with our hosting providers (Railway for the server and database, Cloudflare for
              photos and media), only to run the site and app. All traffic is encrypted over HTTPS.
            </p>
          </Section>

          <Section title="Deleting your data">
            <p>
              You can delete your squad profile at any time in the app: open your player page, tap Edit profile, then
              Delete my profile. This removes your profile, photo and contact details. Committee members, or anyone who
              prefers, can email{" "}
              <a href={`mailto:${EMAIL}`} className="text-paper underline underline-offset-4">
                {EMAIL}
              </a>{" "}
              and we'll delete your account and data within 30 days.
            </p>
          </Section>

          <Section title="Children">
            <p>The club and its app are for adult players and aren't directed at children under 13.</p>
          </Section>

          <Section title="Changes">
            <p>If this policy changes we'll update it here and change the date at the top.</p>
          </Section>
        </div>
      </section>
    </Layout>
  );
}
