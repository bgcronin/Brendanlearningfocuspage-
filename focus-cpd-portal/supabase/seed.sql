-- ============================================================
-- Focus Vision CPD Portal — seed data
-- Run AFTER migration.sql. Creates 3 published example courses
-- with placeholder videos, learning objectives, and MCQs.
-- ============================================================

-- Course 1: Cornea
insert into public.courses (id, title, description, presenter, categories, cpd_hours, is_therapeutic, video_type, video_url, published)
values (
  '11111111-1111-1111-1111-111111111111',
  'Keratoconus: Diagnosis and Modern Management',
  'A practical update on detecting early keratoconus in primary care, interpreting corneal tomography, and current management options including corneal cross-linking and specialty contact lenses. Designed for community optometrists co-managing keratoconus patients.',
  'Dr Brendan Cronin',
  array['cornea'],
  1.5,
  false,
  'embed',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  true
);

insert into public.learning_objectives (course_id, sort_order, objective) values
  ('11111111-1111-1111-1111-111111111111', 1, 'Identify early tomographic signs of keratoconus on Pentacam and OCT imaging'),
  ('11111111-1111-1111-1111-111111111111', 2, 'Describe the indications, technique and outcomes of corneal cross-linking'),
  ('11111111-1111-1111-1111-111111111111', 3, 'Outline a co-management and referral pathway for progressive keratoconus');

insert into public.questions (course_id, sort_order, question_text, options, correct_index, explanation) values
  ('11111111-1111-1111-1111-111111111111', 1,
   'Which tomographic finding is most suggestive of early keratoconus?',
   '["Symmetric bow-tie astigmatism", "Inferior corneal steepening with posterior elevation", "Diffuse corneal thickening", "Central corneal flattening"]',
   1,
   'Inferior steepening combined with posterior corneal elevation is a hallmark of early ectatic change, often before slit-lamp signs appear.'),
  ('11111111-1111-1111-1111-111111111111', 2,
   'The primary goal of corneal cross-linking is to:',
   '["Improve uncorrected visual acuity", "Flatten the cornea for refractive benefit", "Halt progression of ectasia", "Eliminate the need for contact lenses"]',
   2,
   'Cross-linking stiffens the corneal stroma to stop progression. Any flattening or visual improvement is a secondary benefit.'),
  ('11111111-1111-1111-1111-111111111111', 3,
   'A 19-year-old with documented progression of keratoconus should be:',
   '["Reviewed again in 12 months", "Fitted with soft torics and monitored", "Referred promptly for cross-linking assessment", "Advised to start topical steroids"]',
   2,
   'Young age and documented progression are strong indications for prompt cross-linking referral, as progression risk is highest in this group.');

-- Course 2: Glaucoma (example of a therapeutic CPD course)
insert into public.courses (id, title, description, presenter, categories, cpd_hours, is_therapeutic, video_type, video_url, published)
values (
  '22222222-2222-2222-2222-222222222222',
  'Glaucoma Essentials: OCT Interpretation for Optometrists',
  'How to read RNFL and ganglion cell analysis reports with confidence, recognise red and green disease, and decide when to refer. Includes case-based examples of common artefacts and masqueraders.',
  'Dr David Gunn',
  array['glaucoma'],
  1.0,
  true,
  'embed',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  true
);

insert into public.learning_objectives (course_id, sort_order, objective) values
  ('22222222-2222-2222-2222-222222222222', 1, 'Interpret RNFL and ganglion cell OCT reports systematically'),
  ('22222222-2222-2222-2222-222222222222', 2, 'Recognise common OCT artefacts and sources of red/green disease'),
  ('22222222-2222-2222-2222-222222222222', 3, 'Apply referral criteria for glaucoma suspects in primary care');

insert into public.questions (course_id, sort_order, question_text, options, correct_index, explanation) values
  ('22222222-2222-2222-2222-222222222222', 1,
   '"Red disease" on OCT refers to:',
   '["True glaucomatous loss", "Abnormal classification due to artefact or normal variation", "Inflammatory optic neuropathy", "Poor signal strength only"]',
   1,
   'Red disease is a falsely abnormal result — e.g. high myopia or segmentation error flagged red without true pathology.'),
  ('22222222-2222-2222-2222-222222222222', 2,
   'Which parameter is generally the earliest structural indicator of glaucomatous damage?',
   '["Central corneal thickness", "Macular ganglion cell complex thinning", "Cup-to-disc ratio on photos", "Peripapillary atrophy"]',
   1,
   'Ganglion cell complex analysis frequently shows thinning before visual field defects develop and complements RNFL assessment.');

-- Course 3: Refractive
insert into public.courses (id, title, description, presenter, categories, cpd_hours, is_therapeutic, video_type, video_url, published)
values (
  '33333333-3333-3333-3333-333333333333',
  'Refractive Surgery Co-Management: LASIK, PRK and ICL',
  'What every optometrist needs to know when advising patients about refractive surgery: candidacy assessment, the role of topography, comparing LASIK, TransPRK, lenticule extraction and ICL, and post-operative co-management schedules.',
  'Dr Brendan Cronin',
  array['refractive'],
  1.5,
  false,
  'embed',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  true
);

insert into public.learning_objectives (course_id, sort_order, objective) values
  ('33333333-3333-3333-3333-333333333333', 1, 'Assess patient candidacy for laser vision correction and ICL'),
  ('33333333-3333-3333-3333-333333333333', 2, 'Compare the indications and limitations of LASIK, TransPRK, lenticule extraction and ICL'),
  ('33333333-3333-3333-3333-333333333333', 3, 'Implement an evidence-based post-operative co-management schedule');

insert into public.questions (course_id, sort_order, question_text, options, correct_index, explanation) values
  ('33333333-3333-3333-3333-333333333333', 1,
   'Which patient is generally the best candidate for ICL rather than LASIK?',
   '["-2.00 D myope with normal topography", "-10.00 D myope with thin corneas", "+1.00 D hyperope aged 60", "Patient with active keratoconus wanting spectacle independence"]',
   1,
   'High myopia with insufficient corneal tissue for ablation is the classic ICL indication. Active ectasia contraindicates corneal refractive surgery.'),
  ('33333333-3333-3333-3333-333333333333', 2,
   'Following uncomplicated LASIK, the typical minimum dry eye management period is:',
   '["No management needed", "1 week of lubricants", "3–6 months of lubricant support", "Lifelong punctal plugs"]',
   2,
   'Corneal nerve recovery takes months; most patients need lubricant support for 3–6 months post-LASIK.'),
  ('33333333-3333-3333-3333-333333333333', 3,
   'TransPRK may be preferred over LASIK when:',
   '["The patient wants the fastest visual recovery", "Corneal thickness is borderline or the patient has a flap-risk lifestyle", "The patient has severe dry eye untreated", "Cycloplegic refraction is unstable"]',
   1,
   'Surface ablation avoids a flap — useful for thinner corneas and contact-sport or military lifestyles. Unstable refraction is a contraindication for any refractive procedure.');
