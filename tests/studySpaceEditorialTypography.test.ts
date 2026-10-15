import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GRAPHMIND — DISTINCTIVE EDITORIAL TYPOGRAPHY SYSTEM FOR STUDY SPACE', () => {
  const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');

  const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  const indexHtmlPath = path.resolve(__dirname, '../index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

  describe('1. Single Display Font Integration (Inter Tight)', () => {
    it('verifies Inter Tight is loaded with bold editorial weights in index.html', () => {
      assert.ok(
        indexHtml.includes('family=Inter+Tight:wght@500;600;700;800;900'),
        'Inter Tight must be imported from Google Fonts with weights 500-900'
      );
    });

    it('applies Inter Tight via var(--font-display) consistently across all four headings', () => {
      // 1. Continue Learning
      assert.match(
        studyCss,
        /\.study-continue-title\s*\{[\s\S]*?font-family:\s*var\(--font-display,\s*'Inter Tight'/,
        'Continue Learning must use Inter Tight display typeface'
      );

      // 2. Learning Progress
      assert.match(
        studyCss,
        /\.study-trajectory-section-title\s*\{[\s\S]*?font-family:\s*var\(--font-display,\s*'Inter Tight'/,
        'Learning Progress must use Inter Tight display typeface'
      );

      // 3. Assessment History
      assert.match(
        studyCss,
        /\.study-history-header-block \.study-section-title\s*\{[\s\S]*?font-family:\s*var\(--font-display,\s*'Inter Tight'/,
        'Assessment History must use Inter Tight display typeface'
      );

      // 4. Concepts Worth Revisiting
      assert.match(
        studyCss,
        /\.study-revisit-header-block \.study-section-title\s*\{[\s\S]*?font-family:\s*var\(--font-display(?:,\s*'Inter Tight')?/,
        'Concepts Worth Revisiting must use Inter Tight display typeface'
      );
    });
  });

  describe('2. Heading A: "Your learning, in progress." (Continue Learning)', () => {
    it('renders the exact heading copy in StudySpaceView.tsx', () => {
      assert.ok(
        studyViewSrc.includes('Your learning, in progress.'),
        'Must render "Your learning, in progress."'
      );
    });

    it('styles with dominant desktop clamp (44–50px, e.g. 48px), bold 700 weight, 1.05 line-height, and -0.045em tracking', () => {
      assert.match(
        studyCss,
        /\.study-continue-title\s*\{[\s\S]*?font-size:\s*clamp\(34px,\s*4\.4vw,\s*48px\);/,
        'Must clamp up to 48px on desktop (within 44-50px range)'
      );
      assert.match(
        studyCss,
        /\.study-continue-title\s*\{[\s\S]*?font-weight:\s*700;/,
        'Must use bold 700 weight'
      );
      assert.match(
        studyCss,
        /\.study-continue-title\s*\{[\s\S]*?line-height:\s*1\.05;/,
        'Must use tight 1.05 editorial line-height'
      );
      assert.match(
        studyCss,
        /\.study-continue-title\s*\{[\s\S]*?letter-spacing:\s*-0\.045em;/,
        'Must use tight -0.045em letter spacing'
      );
      assert.match(
        studyCss,
        /\.study-continue-title\s*\{[\s\S]*?color:\s*var\(--text-primary,\s*#F5F5F5\);/,
        'Must use near-white #F5F5F5 text color'
      );
    });
  });

  describe('3. Heading B: "Your learning, over time." (Learning Progress)', () => {
    it('renders the exact heading copy in StudySpaceView.tsx', () => {
      assert.ok(
        studyViewSrc.includes('Your learning, over time.'),
        'Must render "Your learning, over time."'
      );
    });

    it('styles with sub-hero desktop clamp (40–46px, e.g. 44px), 700 weight, 1.08 line-height, and -0.04em tracking', () => {
      assert.match(
        studyCss,
        /\.study-trajectory-section-title\s*\{[\s\S]*?font-size:\s*clamp\(32px,\s*3\.8vw,\s*44px\);/,
        'Must clamp up to 44px on desktop (within 40-46px range)'
      );
      assert.match(
        studyCss,
        /\.study-trajectory-section-title\s*\{[\s\S]*?font-weight:\s*700;/,
        'Must use 700 weight'
      );
      assert.match(
        studyCss,
        /\.study-trajectory-section-title\s*\{[\s\S]*?line-height:\s*1\.08;/,
        'Must use 1.08 line-height'
      );
      assert.match(
        studyCss,
        /\.study-trajectory-section-title\s*\{[\s\S]*?letter-spacing:\s*-0\.04em;/,
        'Must use -0.04em letter spacing'
      );
    });
  });

  describe('4. Heading C: "Assessment history"', () => {
    it('renders the exact heading copy in StudySpaceView.tsx', () => {
      assert.ok(
        studyViewSrc.includes('Assessment history'),
        'Must render "Assessment history"'
      );
    });

    it('styles with section desktop clamp (38–44px, e.g. 40px), 700 weight, 1.08 line-height, and -0.04em tracking', () => {
      assert.match(
        studyCss,
        /\.study-history-header-block \.study-section-title\s*\{[\s\S]*?font-size:\s*clamp\(30px,\s*3\.4vw,\s*40px\);/,
        'Must clamp up to 40px on desktop (within 38-44px range)'
      );
      assert.match(
        studyCss,
        /\.study-history-header-block \.study-section-title\s*\{[\s\S]*?font-weight:\s*700;/,
        'Must use 700 weight'
      );
      assert.match(
        studyCss,
        /\.study-history-header-block \.study-section-title\s*\{[\s\S]*?line-height:\s*1\.08;/,
        'Must use 1.08 line-height'
      );
      assert.match(
        studyCss,
        /\.study-history-header-block \.study-section-title\s*\{[\s\S]*?letter-spacing:\s*-0\.04em;/,
        'Must use -0.04em letter spacing'
      );
    });
  });

  describe('5. Heading D: "Concepts worth revisiting"', () => {
    it('renders the exact heading copy in StudySpaceView.tsx', () => {
      assert.ok(
        studyViewSrc.includes('Concepts worth revisiting'),
        'Must render "Concepts worth revisiting"'
      );
    });

    it('styles with section desktop clamp (38–44px, e.g. 40px), 700 weight, 1.08 line-height, and -0.04em tracking', () => {
      assert.match(
        studyCss,
        /\.study-revisit-header-block \.study-section-title\s*\{[\s\S]*?font-size:\s*clamp\(30px,\s*3\.4vw,\s*40px\);/,
        'Must clamp up to 40px on desktop (within 38-44px range)'
      );
      assert.match(
        studyCss,
        /\.study-revisit-header-block \.study-section-title\s*\{[\s\S]*?font-weight:\s*700;/,
        'Must use 700 weight'
      );
      assert.match(
        studyCss,
        /\.study-revisit-header-block \.study-section-title\s*\{[\s\S]*?line-height:\s*1\.08;/,
        'Must use 1.08 line-height'
      );
      assert.match(
        studyCss,
        /\.study-revisit-header-block \.study-section-title\s*\{[\s\S]*?letter-spacing:\s*-0\.04em;/,
        'Must use -0.04em letter spacing'
      );
    });
  });

  describe('6. Supporting Text Subordination', () => {
    it('keeps subtitles clearly secondary with regular weight 400, 15px size, and muted gray #777777', () => {
      // Learning Progress subtitle
      assert.match(
        studyCss,
        /\.study-trajectory-section-desc\s*\{[\s\S]*?font-size:\s*15px;[\s\S]*?font-weight:\s*400;[\s\S]*?color:\s*#777777;/,
        'Learning Progress description must be secondary 15px regular #777777'
      );

      // Assessment History subtitle
      assert.match(
        studyCss,
        /\.study-history-header-block \.study-section-desc\s*\{[\s\S]*?font-size:\s*15px;[\s\S]*?font-weight:\s*400;[\s\S]*?color:\s*#777777;/,
        'Assessment History description must be secondary 15px regular #777777'
      );

      // Concepts Worth Revisiting subtitle
      assert.match(
        studyCss,
        /\.study-revisit-header-block \.study-section-desc\s*\{[\s\S]*?font-size:\s*15px;[\s\S]*?font-weight:\s*400;[\s\S]*?color:\s*#777777;/,
        'Concepts Worth Revisiting description must be secondary 15px regular #777777'
      );
    });
  });

  describe('7. Fluid Responsive Breakpoints (Tablet <= 960px & Mobile <= 640px)', () => {
    it('defines fluid tablet sizes (38px hero, 36px sub-hero, 34px section headings)', () => {
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*960px\)[\s\S]*?\.study-continue-title\s*\{[\s\S]*?font-size:\s*38px;/,
        'Continue Learning must scale to 38px on tablet'
      );
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*960px\)[\s\S]*?\.study-trajectory-section-title\s*\{[\s\S]*?font-size:\s*36px;/,
        'Learning Progress must scale to 36px on tablet'
      );
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*960px\)[\s\S]*?\.study-history-header-block \.study-section-title,[\s\S]*?\.study-revisit-header-block \.study-section-title\s*\{[\s\S]*?font-size:\s*34px;/,
        'Assessment History and Concepts Worth Revisiting must scale to 34px on tablet'
      );
    });

    it('defines fluid mobile sizes (32px hero, 30px sub-hero, 28px section headings)', () => {
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*640px\)[\s\S]*?\.study-continue-title\s*\{[\s\S]*?font-size:\s*32px;/,
        'Continue Learning must scale to 32px on mobile'
      );
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*640px\)[\s\S]*?\.study-trajectory-section-title\s*\{[\s\S]*?font-size:\s*30px;/,
        'Learning Progress must scale to 30px on mobile'
      );
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*640px\)[\s\S]*?\.study-history-header-block \.study-section-title,[\s\S]*?\.study-revisit-header-block \.study-section-title\s*\{[\s\S]*?font-size:\s*28px;/,
        'Assessment History and Concepts Worth Revisiting must scale to 28px on mobile'
      );
    });
  });

  describe('8. Preservation of GraphMind Technical Accents & Restrained Palette', () => {
    it('preserves uppercase lime-green technical eyebrows across sections', () => {
      assert.ok(studyViewSrc.includes('CONTINUE LEARNING'));
      assert.ok(studyViewSrc.includes('LEARNING PROGRESS'));
      assert.ok(studyViewSrc.includes('WORTH ANOTHER LOOK'));
      assert.match(
        studyCss,
        /\.study-continue-kicker\s*\{[\s\S]*?color:\s*var\(--accent,\s*#A3FF12\);/,
        'Continue learning kicker must remain lime-green'
      );
      assert.match(
        studyCss,
        /\.study-trajectory-eyebrow\s*\{[\s\S]*?color:\s*var\(--accent,\s*#A3FF12\);/,
        'Trajectory eyebrow must remain lime-green'
      );
      assert.match(
        studyCss,
        /\.study-revisit-eyebrow\s*\{[\s\S]*?color:\s*var\(--accent,\s*#A3FF12\);/,
        'Revisit eyebrow must remain lime-green'
      );
    });

    it('ensures headings never use glowing text, extra borders, or green heading fills', () => {
      // None of the four headings should have green color or text-shadow glow
      const headingsCss = `
        ${studyCss.match(/\.study-continue-title\s*\{[^}]+\}/)?.[0] || ''}
        ${studyCss.match(/\.study-trajectory-section-title\s*\{[^}]+\}/)?.[0] || ''}
        ${studyCss.match(/\.study-history-header-block \.study-section-title\s*\{[^}]+\}/)?.[0] || ''}
        ${studyCss.match(/\.study-revisit-header-block \.study-section-title\s*\{[^}]+\}/)?.[0] || ''}
      `;
      assert.ok(!headingsCss.includes('text-shadow'), 'Headings must not have glowing text-shadow');
      assert.ok(!headingsCss.includes('color: #A3FF12'), 'Headings must not be colored green');
      assert.ok(!headingsCss.includes('color: var(--accent)'), 'Headings must not be colored green');
    });
  });
});
