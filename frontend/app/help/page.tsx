'use client';

import Link from '@/app/components/AppLink';
import { useLocale } from '@/app/i18n/useI18n';
import { getHelpContent, type HelpTopic } from './helpContent';
import styles from './help.module.css';

function TopicCard({ topic, labels }: { topic: HelpTopic; labels: ReturnType<typeof getHelpContent>['metaLabels'] }) {
  return (
    <article id={topic.slug} className={styles.topicCard}>
      <span className={styles.slug}>{topic.slug}</span>
      <h3>{topic.title}</h3>
      <p>{topic.body}</p>
      <dl className={styles.metaList}>
        <div>
          <dt>{labels.role}</dt>
          <dd>{topic.persona}</dd>
        </div>
        <div>
          <dt>{labels.outcome}</dt>
          <dd>{topic.outcome}</dd>
        </div>
        <div>
          <dt>{labels.next}</dt>
          <dd>{topic.next}</dd>
        </div>
      </dl>
    </article>
  );
}

export default function HelpPage() {
  const locale = useLocale();
  const content = getHelpContent(locale);

  return (
    <main className={styles.shell}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>{content.hero.eyebrow}</span>
          <h1>{content.hero.title}</h1>
          <p>{content.hero.lead}</p>
        </div>
        <nav className={styles.quickLinks} aria-label={content.hero.eyebrow}>
          {content.quickLinks.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
        </nav>
      </header>

      <section className={styles.missionSection}>
        <div className={styles.sectionIntro}>
          <span className={styles.eyebrow}>{content.mission.eyebrow}</span>
          <h2>{content.mission.title}</h2>
          {content.mission.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <div className={styles.missionGrid}>
          {content.mission.benefits.map(([title, body]) => (
            <article key={title} className={styles.missionPanel}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.guideCallout}>
        <div>
          <span className={styles.eyebrow}>{content.scenarioGuide.eyebrow}</span>
          <h2>{content.scenarioGuide.title}</h2>
          <p>{content.scenarioGuide.lead}</p>
        </div>
        <Link href="/help/service-onboarding">{content.scenarioGuide.action}</Link>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionIntro}>
          <span className={styles.eyebrow}>{content.roleSection.eyebrow}</span>
          <h2>{content.roleSection.title}</h2>
          <p>{content.roleSection.lead}</p>
        </div>
        <div className={styles.roleGrid}>
          {content.roleSection.cards.map((guide) => (
            <article key={guide.title} className={styles.roleCard}>
              <span>{guide.role}</span>
              <h2>{guide.title}</h2>
              <p>{guide.purpose}</p>
              <ul>{guide.can.map((item) => <li key={item}>{item}</li>)}</ul>
              <Link href={guide.start}>{guide.action}</Link>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionIntro}>
          <span className={styles.eyebrow}>{content.outputsSection.eyebrow}</span>
          <h2>{content.outputsSection.title}</h2>
          <p>{content.outputsSection.lead}</p>
        </div>
        <div className={styles.outputGrid}>
          {content.outputsSection.items.map(([title, body]) => (
            <article key={title} className={styles.outputCard}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      {content.sections.map((section) => (
        <section key={section.id} id={section.id} className={styles.section}>
          <div className={styles.sectionIntro}>
            <span className={styles.eyebrow}>{content.chapterEyebrow}</span>
            <h2>{section.title}</h2>
          </div>
          <div className={styles.topicGrid}>
            {section.topics.map((topic) => <TopicCard key={topic.slug} topic={topic} labels={content.metaLabels} />)}
          </div>
        </section>
      ))}

      <section id="tutorials" className={styles.section}>
        <div className={styles.sectionIntro}>
          <span className={styles.eyebrow}>{content.tutorials.eyebrow}</span>
          <h2>{content.tutorials.title}</h2>
          <p>{content.tutorials.lead}</p>
        </div>
        <div className={styles.tutorialList}>
          <article className={styles.tutorial}>
            <h3>{content.tutorials.newServiceTitle}</h3>
            <ol>{content.tutorials.newServiceSteps.map(([title, body]) => <li key={title}><strong>{title}:</strong> {body}</li>)}</ol>
          </article>
          <article className={styles.tutorial}>
            <h3>{content.tutorials.commonMistakesTitle}</h3>
            <ul className={styles.compactList}>{content.tutorials.commonMistakes.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
          <article className={styles.tutorial}>
            <h3>{content.tutorials.relationRulesTitle}</h3>
            <ul className={styles.compactList}>{content.tutorials.relationRules.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
          <article className={styles.tutorial}>
            <h3>{content.tutorials.adminTitle}</h3>
            <ul className={styles.compactList}>{content.tutorials.adminChecks.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        </div>
      </section>

      <section className={styles.splitSection}>
        <article className={styles.panel}>
          <span className={styles.eyebrow}>{content.audit.eyebrow}</span>
          <h2>{content.audit.title}</h2>
          {content.audit.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </article>
        <article className={styles.panel}>
          <span className={styles.eyebrow}>{content.overlap.eyebrow}</span>
          <h2>{content.overlap.title}</h2>
          {content.overlap.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <Link href="/services/consolidation-matrix">{content.overlap.action}</Link>
        </article>
      </section>
    </main>
  );
}
