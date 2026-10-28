import type { ReactNode } from 'react'
import { APP_NAME } from '@/hooks/use-document-title'

const TERMS_EFFECTIVE_DATE = 'October 28, 2026'

/** The Terms of Service. Keep it in step with what the app actually does. */
export function TermsOfService() {
  return (
    <article className="flex flex-col gap-8 text-sm leading-relaxed">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="text-muted-foreground">Effective {TERMS_EFFECTIVE_DATE}</p>
        <p>
          These terms apply to your use of {APP_NAME} (“the website”, “we”, “us”). By using the
          website you agree to them. If you don't agree, please don't use the website.
        </p>
      </header>

      <Section title="1. What the website does">
        <p>
          {APP_NAME} is a free tool for finding Plays.tv clips that were saved by the Internet
          Archive's Wayback Machine after Plays.tv shut down in December 2019. You can search a
          Plays.tv username or paste links to Plays.tv clips; the website then looks for archived
          copies of the profile, its clip list, thumbnails, previews and full-length videos.
        </p>
        <p>
          {APP_NAME} is not affiliated with, endorsed by or connected to Plays.tv, its former
          owners, or the Internet Archive. Product and game names belong to their respective
          owners.
        </p>
      </Section>

      <Section title="2. Where the content comes from">
        <p>
          <strong>We don't own any of the clips, titles, usernames, avatars or other content
          shown on the website, and we didn't create or upload any of it.</strong> Every clip was
          originally uploaded to Plays.tv by one of its users. Copies of those pages and files
          were later saved to the Wayback Machine by the Internet Archive and by people using
          its public archiving tools. {APP_NAME} only finds and displays what is already publicly
          available there.
        </p>
        <p>
          Full-length videos play and download straight from the Wayback Machine. To keep the
          website fast, we store our own copies of thumbnails, short hover previews and profile
          pictures, along with each clip's title, game, length and upload date as they appear in
          the archive. Profiles that have been looked up are kept, may appear in the list of
          recently retrieved profiles, and their recovered clips may appear in the public feed.
        </p>
        <p>
          Because the content was made by other people, we can't vouch for it. Some clips may
          be offensive, inaccurate or otherwise objectionable, and you view them at your own
          risk.
        </p>
      </Section>

      <Section title="3. Reporting content and how it's removed">
        <p>
          If you think a clip breaks these terms or the law, open it and use the{' '}
          <strong>Report</strong> button. You can report sexual content, violence or gore, hate
          speech, harassment or bullying, someone's personal information, illegal activity,
          spam or misleading content, copyright infringement, or something else. Reports are
          anonymous.
        </p>
        <p>
          Reports are reviewed by an administrator. If a clip is found to break these terms, we
          may, at our discretion and without notice:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            remove it from the website, so it no longer appears in searches, profiles, the feed
            or shared links, and delete any images of it that we stored; or
          </li>
          <li>
            hide its title, which then shows as <em>(Title removed due to TOS violation)</em>.
          </li>
        </ul>
        <p>
          This is the only way content is removed from {APP_NAME}. If you are the person shown
          in a clip, or own the rights to it, report it with the matching reason and add
          details that help us confirm the problem. We may restore content we removed by
          mistake.
        </p>
        <p>
          Removing a clip from {APP_NAME} doesn't remove it from the Wayback Machine. To have
          the archived copy itself taken down, contact the Internet Archive directly.
        </p>
      </Section>

      <Section title="4. Using the website">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>use the website for anything unlawful, or to harass or harm anyone;</li>
          <li>
            send automated or bulk requests, scrape the website, or otherwise put an
            unreasonable load on it or on the Internet Archive;
          </li>
          <li>get around rate limits or other restrictions, or file false or abusive reports;</li>
          <li>
            try to access parts of the website or its systems you aren't authorised to use,
            including administrative areas; or
          </li>
          <li>
            re-upload, sell or otherwise use content found here in a way that infringes the
            rights of the people who made it.
          </li>
        </ul>
        <p>
          Downloading a clip doesn't give you any rights to it. Whether you may use, share or
          re-upload a clip depends on its creator and the law where you are, and is your
          responsibility.
        </p>
      </Section>

      <Section title="5. Privacy">
        <p>
          There are no accounts and we don't collect personal information about visitors. We
          keep the usernames and clip links that are searched for, whether each search found
          anything, and reports (the reason and any details you write), none of it linked to
          you. Your browser stores your theme and video player settings locally on your device.
        </p>
      </Section>

      <Section title="6. No warranty">
        <p>
          The website is provided “as is” and “as available”, for free, without warranties of
          any kind, express or implied, including fitness for a particular purpose,
          availability, accuracy and non-infringement. The Wayback Machine didn't save every
          clip, archived data may be incomplete or wrong, and we can't guarantee that any clip
          can be found or recovered. The website, or any part of it, may change, be unavailable
          or be shut down at any time without notice.
        </p>
      </Section>

      <Section title="7. Limitation of liability">
        <p>
          To the fullest extent permitted by law, {APP_NAME} and the people who run it are not
          liable for any indirect, incidental, special, consequential or punitive damages, or
          for any loss of data, content, profits or goodwill, arising from your use of (or
          inability to use) the website or any content found through it. Nothing in these terms
          limits liability that can't be limited by law.
        </p>
      </Section>

      <Section title="8. Indemnity">
        <p>
          You agree to hold {APP_NAME} and the people who run it harmless from any claims,
          damages or costs arising from your breach of these terms or your use of content
          found through the website.
        </p>
      </Section>

      <Section title="9. Changes to these terms">
        <p>
          We may update these terms from time to time. The effective date above shows when they
          last changed. Continuing to use the website after a change means you accept the
          updated terms.
        </p>
      </Section>

      <Section title="10. General">
        <p>
          If any part of these terms is found unenforceable, the rest still applies. Not
          enforcing a part of these terms doesn't waive our right to enforce it later. These
          terms are the whole agreement between you and us about the website.
        </p>
      </Section>
    </article>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  )
}
