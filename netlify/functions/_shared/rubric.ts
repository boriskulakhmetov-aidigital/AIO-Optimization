export const RUBRIC_TEXT = `# NEUROMARKETING & COLOR PSYCHOLOGY AUDIT - FULL RUBRIC v2.0

41 criteria - 3 sections - Anti-drift protocols P1-P16 integrated

---

# ASSET TYPE TAXONOMY

## Tier 1 - CREATIVE (impression/engagement formats)
Dwell time <15s. Evaluation is single-frame or single-sequence.

| Code | Type |
|------|------|
| C1 | Static Display Ad - single frame, non-animated, digital |
| C2 | Animated/Motion Creative - multi-frame, GIF/HTML5, looping |
| C3 | Video Creative - full motion, temporal, typically with audio |
| C4 | Social Feed Post - single frame, feed-native |
| C5 | Social Carousel - sequential swipeable frames |

Creative tier N/A defaults: 1.4, 1.7, 1.8, 2.1, 2.6*, 2.12, 2.14*, 3.8, 3.11 typically N/A.
2.6/2.7/2.8 subject to 25-word minimal-copy threshold for ALL creative subtypes.
2.14 N/A for C1/C4; PRIMARY for C2; conditional for C3.

## Tier 2 - PAGE/DESTINATION (dwell formats)
Dwell time >15s. Full criterion coverage.

| Type | Description |
|------|-------------|
| Landing Page | Single-scroll, one conversion goal (~38/41 scored) |
| Full Website | Multi-page, navigable (~38/41 scored) |
| Email | HTML email, inbox-delivered (32-38/41 scored). 3.11 = PRIMARY. 1.4 = preview pane. 2.1 always scored. |

---

# SCORING FRAMEWORK

## Score Types
- [Compliance] Blue: Measurable against published standard (WCAG, brand guide)
- [Measurable] Green: Quantifiable through layout analysis or visual inference
- [Subjective] Yellow: Professional judgment grounded in rubric descriptors + P15 anchors

## Cultural Deduction Scale
| Code | Severity | Points |
|------|----------|--------|
| C0 | No mismatch | 0 |
| C1 | Direct conflict | -4 |
| C2 | Significant mismatch | -2 |
| C3 | Minor friction | -1 |

Ceiling rule: C1 or C2 caps adjusted final at 6 max. 9-10 requires C0.

## Overall Score Formula
Overall Score = Sum of all scored criteria final scores / Total scored criteria.
Do NOT average section averages. Flat weighted.

## Minimal-Copy N/A Threshold
<25 words evaluable copy -> 2.6, 2.7, 2.8 = N/A.

---

# SECTION 1 - BEHAVIORAL ANALYTICS

## 1.1 - First Fixation Point [Measurable]
CONCEPT: First fixation = where the eye lands within 300-500ms of page load.
SCIENCE: Karulkar et al. (2024); Koch & Ullman (1985) saliency map model.

| Score | Description |
|-------|-------------|
| 1-2 | First fixation lands on non-conversion element. Hero absent from entry zone. |
| 3-4 | Hero present but competes with 2+ equal-weight elements. |
| 5-6 | Hero likely first fixation but lacks full visual isolation. |
| 7-8 | Hero clearly dominant. Minor competing elements subordinate. |
| 9-10 | Hero is unambiguous first fixation. Visually isolated. |

Cultural Deductions: RTL audience + LTR hero -> C1 (-4). Layout direction not validated -> C3 (-1).

---

## 1.2 - Gaze Flow [Measurable]
PROTOCOL 1 (Structured Visual Observation) MANDATORY.

| Score | Description |
|-------|-------------|
| 1-2 | Layout contradicts expected gaze pattern. Key elements in blind spots. |
| 3-4 | Gaze pattern not reflected in layout. |
| 5-6 | Primary content in gaze path; secondary elements outside. |
| 7-8 | Content hierarchy follows expected gaze pattern well. |
| 9-10 | Every conversion-critical element within dominant gaze path. |

Cultural Deductions: RTL on LTR layout -> C1. Bilingual mixed-direction -> C2. CJK without validation -> C3.

---

## 1.3 - Attention Hotspots [Measurable]

| Score | Description |
|-------|-------------|
| 1-2 | High-attention zones occupied by decoration/nav. Conversion content below fold. |
| 3-4 | Some conversion content in hotspot zones but diluted. |
| 5-6 | Primary USP in hotspot zone. CTA or social proof misplaced. |
| 7-8 | Headline, USP, and CTA all within high-attention zones. |
| 9-10 | Every conversion-critical element in validated high-fixation zone. |

Cultural Deductions: RTL audience with LTR hotspot logic -> C2. Mobile-first market, desktop-only -> C2.

---

## 1.4 - Fold Behavior [Subjective]
N/A for C1-C4 creatives. For Email: evaluate against preview pane (first ~300px + subject + preheader).

| Score | Description |
|-------|-------------|
| 1-2 | Above-fold is generic/incomplete. No scroll reason. |
| 3-4 | Category identified but offer/differentiator not communicated. |
| 5-6 | Offer present but no scroll trigger. |
| 7-8 | Communicates who/what/why + at least one scroll trigger. |
| 9-10 | Answers arrival question completely. Scroll trigger present. Adapted to channel. |

---

## 1.5 - CTA Visibility [Measurable]

| Score | Description |
|-------|-------------|
| 1-2 | No CTA visible without scrolling, or indistinguishable from content. |
| 3-4 | CTA exists but low-contrast, small, or competing. |
| 5-6 | CTA visible and recognizable. Generic label. Some competition. |
| 7-8 | Clearly visible, distinct color, specific action-oriented label. |
| 9-10 | Most prominent actionable element at every scroll depth. Verb-first, benefit-led, isolated. |

---

## 1.6 - Information Scannability [Measurable]

| Score | Description |
|-------|-------------|
| 1-2 | Scanning yields no understanding of the offer. |
| 3-4 | Category identifiable but offer/action unclear without body copy. |
| 5-6 | Offer partially scannable. |
| 7-8 | 5-second scan yields clear understanding of offer and audience. |
| 9-10 | Headline + subheadline + headers + CTA tell complete conversion story. |

---

## 1.7 - Chunking [Compliance]
Hard floor: Any list/group >10 items without sub-grouping -> cannot exceed 4.

| Score | Description |
|-------|-------------|
| 1-2 | Multiple lists of 10+. Walls of text. |
| 3-4 | Most groups 8-10 items. Hard floor if any >10. |
| 5-6 | Majority 5-8 items. 1-2 over-extended. |
| 7-8 | All lists and groups 5-7. |
| 9-10 | Every group 5-7. Sub-grouping applied. |

---

## 1.8 - Progressive Disclosure [Subjective]
N/A for C1-C4.

| Score | Description |
|-------|-------------|
| 1-2 | All information front-loaded at equal weight. |
| 3-4 | Some layering but secondary info still dominates. |
| 5-6 | Primary/secondary hierarchy present. Some over-explanation. |
| 7-8 | Clear hook -> benefit -> proof -> detail. |
| 9-10 | Every layer revealed at point of demonstrated interest. |

---

## 1.9 - Novelty Triggers [Subjective]
PROTOCOL 15 MANDATORY. Count novelty elements before scoring.
P15 anchors: 0 elements -> 1-2 | 1 element -> 3-4 | 2 elements -> 5-6 | 3+ elements -> 7-8 | Every section surprises -> 9-10
State: "Novelty elements identified: [N] - [list them]"

| Score | Description |
|-------|-------------|
| 1-2 | 0 novelty elements. Entirely conventional. Indistinguishable from category. |
| 3-4 | 1 novelty element. Minor differentiation. No curiosity trigger. |
| 5-6 | 2 novelty elements. Creates initial curiosity but doesn't sustain. |
| 7-8 | 3+ novelty triggers distributed. Desire to explore. |
| 9-10 | Every section contains at least one surprise element. Rewards continued attention. |

---

## 1.10 - Loss Aversion Cues [Subjective]
Hard floor: Verifiably false scarcity -> forced score of 1.

| Score | Description |
|-------|-------------|
| 1-2 | No loss-frame present. All gain-oriented. |
| 3-4 | Vague urgency without credible mechanism. |
| 5-6 | One credible loss-frame element, not prominent. |
| 7-8 | Clear, credible loss framing integrated into value proposition. |
| 9-10 | Multiple calibrated loss cues. Social proof loss. Scarcity verified. |

---

## 1.11 - Social Proof Placement [Measurable]

| Score | Description |
|-------|-------------|
| 1-2 | No social proof or buried below fold. |
| 3-4 | Present but disconnected from conversion context. |
| 5-6 | Near CTA but not in direct visual relationship. |
| 7-8 | Immediately adjacent to CTA or within same visual group. |
| 9-10 | Social proof is last thing before CTA. Format matches audience. |

---

## 1.12 - Anchoring [Measurable]

| Score | Description |
|-------|-------------|
| 1-2 | No anchor present. Price in isolation. |
| 3-4 | Anchor present but not visually connected. |
| 5-6 | Anchor and price visible together. Standard presentation. |
| 7-8 | Anchor placed before price in reading order. Savings calculated. |
| 9-10 | Anchor + savings in format best suited to price tier. |

---

## 1.13 - Hick's Law Compliance [Compliance]
PROTOCOL 5b applies to brand awareness creatives.

| Score | Description |
|-------|-------------|
| 1-2 | >5 equally weighted choices simultaneously. |
| 3-4 | 3-5 choices with weak visual hierarchy. |
| 5-6 | Clear primary CTA. Secondary options subordinated. |
| 7-8 | Each section has one primary CTA. Secondary visually subordinate. |
| 9-10 | Binary choice per section. Friction-free. |

---

# SECTION 2 - CONGRUENCY & USER STRAIN

## 2.1 - Ad-to-Page Match [Measurable]
N/A if source creative not provided (Landing Page / Full Website).
For Email: ALWAYS scored as inbox-listing-to-body match.

| Score | Description |
|-------|-------------|
| 1-2 | No continuity between source and landing. |
| 3-4 | Brand present but messaging/visual disconnect. |
| 5-6 | Message partially reflected. Visual language differs. |
| 7-8 | Headline and visual language match. Seamless. |
| 9-10 | Perfect scent trail. Exact promise fulfilled. |

---

## 2.2 - Visual-to-Copy Alignment [Subjective]

| Score | Description |
|-------|-------------|
| 1-2 | Imagery contradicts copy. |
| 3-4 | Imagery neutral. Doesn't support copy. |
| 5-6 | Broadly aligned. Not specifically illustrating claim. |
| 7-8 | Imagery directly illustrates primary copy claim. |
| 9-10 | Every image creates a specific visual proof of a specific claim. |

---

## 2.3 - Brand Voice Consistency [Subjective]
PROTOCOL 15 MANDATORY. Count voice registers.
P15 rules: Read page linearly. Count distinct voice registers.
1 register -> 7-8 | 2 registers -> 5-6 | 3 registers -> 3-4 | 4+ -> 1-2
State: "Voice registers identified: [N] - [describe each]"

| Score | Description |
|-------|-------------|
| 1-2 | 4+ voice registers. Fragmented. No coherent brand voice. |
| 3-4 | 3 voice registers. Notable register breaks between sections. |
| 5-6 | 2 voice registers. Minor inconsistency. |
| 7-8 | 1 consistent voice register. Recognizable brand personality. |
| 9-10 | Voice is a strategic asset. Distinctive, consistent, audience-calibrated. |

---

## 2.4 - Offer Clarity [Measurable]

| Score | Description |
|-------|-------------|
| 1-2 | No identifiable offer after 10-second review. |
| 3-4 | Offer partially describable but price/scope/commitment ambiguous. |
| 5-6 | Offer clear in broad terms but one element buried. |
| 7-8 | Complete offer visible: what, for whom, at what price, how to get it. |
| 9-10 | Offer is immediately unambiguous. No interpretation needed. |

---

## 2.5 - Visual Noise Audit [Measurable]

| Score | Description |
|-------|-------------|
| 1-2 | Screen is visually overwhelming. No resting point. |
| 3-4 | 3+ visual elements compete for attention simultaneously. |
| 5-6 | Primary element is identifiable but surrounded by competing signals. |
| 7-8 | Clear visual hierarchy. Non-essential elements recede. |
| 9-10 | Every element has purpose. No decorative noise. |

---

## 2.6 - Copy Density [Compliance]
Subject to Minimal-Copy N/A Threshold. N/A for C1-C5 with <25 words.
Hard floor: Any paragraph 8+ unbroken lines -> cannot exceed 4.

| Score | Description |
|-------|-------------|
| 1-2 | Paragraphs 6-10+ lines. Hard floor may apply. |
| 3-4 | Multiple paragraphs 5-7 lines. |
| 5-6 | Most paragraphs 3-4 lines. 1-2 over-extended. |
| 7-8 | Paragraphs consistently 2-3 lines. Sentences <=18 words. |
| 9-10 | Every paragraph <=3 lines. Effortless reading. |

---

## 2.7 - Flesch-Kincaid Grade Level [Compliance]
Subject to Minimal-Copy N/A Threshold.
Hard floor: Copy 4+ grade levels above benchmark -> cannot exceed 3.
Benchmarks: Mass = Grade 5-6 | B2C = 6-8 | B2B = 8-10 | Technical = 10-14.

| Score | Description |
|-------|-------------|
| 1-2 | 5+ grade levels above benchmark. |
| 3-4 | 3-4 grade levels above. |
| 5-6 | 1-2 grade levels above. |
| 7-8 | Within benchmark range. |
| 9-10 | Hits benchmark center. Active voice predominates. |

---

## 2.8 - Jargon Index [Measurable]
Subject to Minimal-Copy N/A Threshold.

| Score | Description |
|-------|-------------|
| 1-2 | 50%+ terms are jargon. Unexplained acronyms throughout. |
| 3-4 | 30-50% jargon density. |
| 5-6 | 15-30% jargon. Key terms generally explained. |
| 7-8 | <15% jargon. All acronyms explained on first use. |
| 9-10 | Fully accessible. Zero unexplained terms. |

---

## 2.9 - Cognitive Tunneling [Subjective]
PROTOCOL 5 (Brand Creative Anchor) applies.
PROTOCOL 12 (Multi-Campaign Cascade) applies when multi-campaign confirmed.
P12 rule: With confirmed multi-campaign, 2.9 baseline = 3-4 band.

| Score | Description |
|-------|-------------|
| 1-2 | Dual or contradictory messaging. User cannot resolve. |
| 3-4 | Two+ distinct message tracks compete. [Default with multi-campaign.] |
| 5-6 | Minor message dilution but primary dominates. |
| 7-8 | Single message clearly primary. Supporting evidence aligned. |
| 9-10 | Every element reinforces single conversion narrative. |

---

## 2.10 - Contrast Ratio [Compliance]
PROTOCOL 4 (Estimation Boundaries) applies. No claimed ratios without measurement.
Hard floor: Body text fails WCAG 4.5:1 -> cannot exceed 3.

| Score | Description |
|-------|-------------|
| 1-2 | Below AA minimum throughout. |
| 3-4 | Some pass, some fail. |
| 5-6 | All elements appear to meet AA. |
| 7-8 | All exceed AA comfortably. |
| 9-10 | AAA met throughout. |

---

## 2.11 - Font Size & Legibility [Compliance]
Hard floor: Body text <14px -> cannot exceed 3.

| Score | Description |
|-------|-------------|
| 1-2 | Below 12px. |
| 3-4 | 12-13px. |
| 5-6 | 14-15px. |
| 7-8 | 16px+. Comfortable. |
| 9-10 | Typography optimized. Size, spacing, weight calibrated. |

---

## 2.12 - Line Length [Compliance]
Hard floor: Primary column >100 chars -> cannot exceed 4.

| Score | Description |
|-------|-------------|
| 1-2 | >100 characters. |
| 3-4 | 80-100. |
| 5-6 | 65-80. |
| 7-8 | 45-65. |
| 9-10 | Deliberately constrained. Responsive maintained. |

---

## 2.13 - Whitespace Usage [Subjective]

| Score | Description |
|-------|-------------|
| 1-2 | Minimal whitespace. CTAs buried. |
| 3-4 | Some section-level whitespace but tightly packed. |
| 5-6 | Adequate between major sections. |
| 7-8 | Generous. Page feels open. |
| 9-10 | Whitespace is a deliberate design tool. |

---

## 2.14 - Animation & Motion [Compliance]
N/A for C1, C4. PRIMARY for C2.
Hard floor: WCAG 2.3.1 flash violation -> automatic score of 1.

| Score | Description |
|-------|-------------|
| 1-2 | Flash violation. Auto-play looping. |
| 3-4 | Decorative animations compete with message. |
| 5-6 | Animations in peripheral only. |
| 7-8 | All motion purposeful. |
| 9-10 | Motion is a precision tool. No decorative motion. |

---

## 2.15 - Imagery-Emotion Alignment [Subjective]
PROTOCOL 3 and PROTOCOL 15 apply.
State: "[N/M] hero images evoke intended emotional state"

| Score | Description |
|-------|-------------|
| 1-2 | Imagery evokes wrong emotional state. |
| 3-4 | Imagery emotionally neutral. |
| 5-6 | Hero imagery evokes intended state. Secondary neutral. |
| 7-8 | All primary imagery evokes intended state. |
| 9-10 | Every image creates specific emotional reaction at specific point. |

Cultural Deductions: Expressive smiling for East Asian -> C2. Glossy stock for Northern European -> C2. Individual focus for collectivist -> C2. Religious/dress violation -> C1.

---

## 2.16 - Facial Direction Cues [Measurable]
PROTOCOL 1 (Structured Visual Observation) MANDATORY.

| Score | Description |
|-------|-------------|
| 1-2 | Faces oriented away from all conversion content. |
| 3-4 | Forward-facing. Neutral - missed opportunity. |
| 5-6 | Primary face oriented toward CTA or headline. |
| 7-8 | All major faces toward primary conversion element. |
| 9-10 | Every face leads specifically toward CTA, headline, or proof. |

---

## 2.17 - Headline-Emotion Fit [Subjective]

| Score | Description |
|-------|-------------|
| 1-2 | Headline speaks to completely different awareness stage. |
| 3-4 | Factually correct but emotionally mismatched. |
| 5-6 | Addresses right stage. Emotional register neutral. |
| 7-8 | Matches both awareness stage and emotional state of traffic source. |
| 9-10 | Precision-calibrated to specific emotional state of arriving user. |

---

# SECTION 3 - COLOR & COLOR PSYCHOLOGY

## 3.1 - Brand Color Adherence [Compliance]
PROTOCOL 15 ceiling: Without brand guide, maximum score = 6. State: "Palette inferred. P15 ceiling applied."
Hard floor: Off-brand on primary CTA -> cannot exceed 4.

| Score | Description |
|-------|-------------|
| 1-2 | Multiple off-brand colors throughout. |
| 3-4 | Primary colors present but key elements use unauthorized variants. |
| 5-6 | Brand colors mostly correct. 2-3 minor hex deviations. |
| 6 max w/o guide | Inferred palette consistent. Cannot verify precision without guide. |
| 7-8 | All brand colors exact. [Requires brand guide.] |
| 9-10 | Brand colors applied with precision as communication tool. [Requires guide.] |

---

## 3.2 - CTA Color / Von Restorff Effect [Compliance]
PROTOCOL 2 MANDATORY. Use SAME count from 3.4.
Hard floor: CTA color 5+ times in non-signal contexts -> cannot exceed 4.

| Score | Description |
|-------|-------------|
| 1-2 | CTA is brand primary used throughout. Zero isolation. |
| 3-4 | CTA color 3-5 times in non-CTA contexts. |
| 5-6 | CTA color 1-2 times outside CTAs. |
| 7-8 | CTA color only on buttons + 1 highlight. 3:1+ contrast. |
| 9-10 | CTA color exclusively on primary CTAs. 4.5:1+ contrast. |

---

## 3.3 - Color Hierarchy [Subjective]

| Score | Description |
|-------|-------------|
| 1-2 | All elements equal visual weight. No hierarchy. |
| 3-4 | Some differentiation but inconsistent. |
| 5-6 | Primary elements clearly most prominent. |
| 7-8 | Clear three-tier: primary -> secondary -> tertiary. |
| 9-10 | Color hierarchy mirrors conversion priority with precision. |

---

## 3.4 - Accent Color Discipline [Measurable]
PROTOCOL 2 MANDATORY. Record count here; reused in 3.2.

| Score | Description |
|-------|-------------|
| 1-2 | Accent pervasive. Signal function lost. |
| 3-4 | 10+ instances. Substantial decorative use. |
| 5-6 | 6-9 instances. Some decorative dilution. |
| 7-8 | 3-5 instances, exclusively on CTAs and high-priority signals. |
| 9-10 | <=3 instances. Each is a primary action signal. |

---

## 3.5 - Color Psychology Match [Subjective]
PROTOCOL 3 applies when multiple markets specified.

| Score | Description |
|-------|-------------|
| 1-2 | Dominant color contradicts brand positioning for target. |
| 3-4 | Not harmful but misaligned with category trust palette. |
| 5-6 | Dominant color neutral for category. |
| 7-8 | Appropriate for category. Evokes intended state. |
| 9-10 | Colors deliberately selected and validated for target audience. |

---

## 3.6 - Above-the-Fold Palette [Subjective]

| Score | Description |
|-------|-------------|
| 1-2 | Fold palette contradicts below-fold. |
| 3-4 | Palette shift across fold noticeable. |
| 5-6 | Generally consistent. |
| 7-8 | Fold palette is strongest brand color expression. |
| 9-10 | Fold palette designed for immediate emotional impact. |

---

## 3.7 - Background vs. Foreground [Compliance]

| Score | Description |
|-------|-------------|
| 1-2 | Background competes in multiple sections. |
| 3-4 | Most OK but 1-2 conflict areas. |
| 5-6 | Clear separation throughout. |
| 7-8 | Background clearly subordinate throughout. |
| 9-10 | Background perceptually invisible - defines space only. |

---

## 3.8 - Error & Success State Colors [Compliance]
N/A for creatives, Email (unless AMP), and pages without visible form states.
Hard floor: Color sole means -> cannot exceed 3.

| Score | Description |
|-------|-------------|
| 1-2 | Color-only signals. WCAG violation. |
| 3-4 | Color present but inverted or non-standard. |
| 5-6 | Standard red/green but color only. |
| 7-8 | Standard + icon backup. |
| 9-10 | Color + icon + actionable text. Fully accessible. |

---

## 3.9 - Color Count [Measurable]
PROTOCOL 2 counting rules apply.

| Score | Description |
|-------|-------------|
| 1-2 | 7+ distinct non-photographic colors. |
| 3-4 | 5-6 dominant. |
| 5-6 | 4-5 including accents. |
| 7-8 | 3 dominant + 1-2 accents. |
| 9-10 | <=3 dominant + 1 accent. Every color has defined role. |

---

## 3.10 - Color Harmony Model [Subjective]

| Score | Description |
|-------|-------------|
| 1-2 | No apparent model. |
| 3-4 | Rough model but inconsistent. |
| 5-6 | Model present and mostly consistent. |
| 7-8 | Clear intentional model. Serves emotional positioning. |
| 9-10 | Model creates specific differentiating emotional impact. |

---

## 3.11 - Dark/Light Mode Integrity [Subjective]
N/A unless both modes implemented. PRIMARY for Email audits.

| Score | Description |
|-------|-------------|
| 1-2 | Automatic CSS inversion. Illegible or contradictory. |
| 3-4 | Functional but emotional character changed significantly. |
| 5-6 | Visually acceptable. Some elements need adjustment. |
| 7-8 | Dark mode maintains brand intent. WCAG AA met in both. |
| 9-10 | Both modes independently optimized. WCAG AA in both. |

---

# ANTI-DRIFT PROTOCOLS

## PROTOCOL 1 - Structured Visual Observation (applies to 1.2, 2.16)
Three-step observation:
Step 1: Physical observation in objective spatial terms.
Step 2: Trace directional vector - what elements does it intersect?
Step 3: Assess target alignment - compare to conversion-critical elements.
Ambiguity rule: if genuinely ambiguous, score 5-6 with flag [Gaze direction ambiguous - heatmap validation recommended]. Do not score above 7 or below 4 when ambiguous.

## PROTOCOL 2 - Deterministic Element Counting (applies to 3.2, 3.4, 3.9)
One instance = one visually distinct object or surface.
Sub-patterns within an object don't count separately.
3.4 establishes canonical count. 3.2 MUST use identical count.
3.9 color counting: photographic tones below 30% surface area and low saturation = exempt.

## PROTOCOL 3 - Deterministic Cultural Deduction
1. Evaluate every market independently
2. Apply most sensitive market's deduction
3. Single highest deduction - don't stack
4. Document which market triggered
5. Apply consistently across all relevant criteria
Citation format: TRIGGER - MARKET - EVIDENCE - AMOUNT

## PROTOCOL 4 - Contrast Estimation Boundaries
Do NOT claim specific numerical ratios unless measured with validated tools.

## PROTOCOL 5 - Cognitive Tunneling Anchor for Brand Creatives
Emotional + informational channels serving same brand message ≠ dual messaging. Score based on competing messages, not competing visual channels.

## PROTOCOL 5b - Hick's Law Anchor for Brand Creatives
Product portfolio display in brand awareness context = visual merchandising, not decision architecture. Score based on competing action paths, not number of products shown.

## PROTOCOL 6 - Cross-Criterion Consistency Checks
1. 3.2 and 3.4 count consistency
2. 1.2 and 2.16 gaze consistency
3. Cultural deduction consistency across all criteria
4. N/A consistency between section detail and summary

## PROTOCOL 7 - Anti-Hallucination
Never invent competitor campaign names, creative descriptions, talent, strategy details, or market data.

## PROTOCOL 8 - Score Anchoring
Complete 5 anchor questions before scoring:
ANCHOR 1 - CTA PRESENCE: [YES/TAGLINE ONLY/NO] -> baseline band (YES: 6-8 | TAGLINE: 4-6 | NO: 1-3)
ANCHOR 2 - SOCIAL PROOF PRESENCE: [YES/NO] -> (YES: baseline 6-8 | NO: baseline 3-5)
ANCHOR 3 - LOSS FRAME PRESENCE: [YES/NO] -> (YES: 5-8 band | NO: 1-4 band)
ANCHOR 4 - COPY VOLUME: [word count] -> N/A determination (<25 words: 2.6/2.7/2.8 = N/A)
ANCHOR 5 - ASSET TYPE GATE: [type] -> expected N/A list

## PROTOCOL 9 - Arithmetic Verification
Show explicit sums. Verify by re-adding.
Format: Section X: A(n) + B(n) + ... = [sum] / [count] = X.X

## PROTOCOL 10 - Asset Type Lock
The locked type from INTAKE_SUMMARY is final. Do NOT reclassify.

## PROTOCOL 11 - Mandatory Hard Floor Pre-Scan
Before scoring ANY criterion, check all 11 conditions:
1. List/group >10 items? [YES/NO] Evidence: ___
2. Paragraph 8+ lines? [YES/NO] Evidence: ___
3. Copy 4+ grades above benchmark? [YES/NO] Evidence: ___
4. Body text fails 4.5:1? [YES/NO] Evidence: ___
5. Body text <14px? [YES/NO] Evidence: ___
6. Column >100 chars/line? [YES/NO] Evidence: ___
7. WCAG 2.3.1 flash? [YES/NO] Evidence: ___
8. Off-brand CTA colors? [YES/NO] Evidence: ___
9. CTA color 5+ non-signal? [YES/NO] Evidence: ___
10. Color-only error/success? [YES/NO] Evidence: ___
11. False scarcity? [YES/NO] Evidence: ___

## PROTOCOL 12 - Multi-Campaign Impact Cascade
Trigger: multi_campaign.confirmed = true.
Expected impacts: 2.4 PENALIZE | 2.9 PENALIZE (baseline defaults 3-4) | 2.3 PENALIZE | 1.8 PENALIZE | 1.13 PENALIZE | 2.5 PENALIZE | 2.17 PENALIZE | 1.10 NEUTRAL.

## PROTOCOL 13 - Executive Summary Post-Arithmetic
Executive Summary written LAST after P9 verification. Add [Scores verified per Protocol 9].

## PROTOCOL 14 - Anchor Immutability
P8 anchor answers use exact rubric baseline bands verbatim. Observations in parentheses only.

## PROTOCOL 15 - Subjective Criterion Stabilization
1.9 Novelty: count elements. 0->1-2 | 1->3-4 | 2->5-6 | 3+->7-8 | every section->9-10
2.3 Brand Voice: count registers. 1->7-8 | 2->5-6 | 3->3-4 | 4+->1-2
2.15 Imagery-Emotion: name state, evaluate each hero image.
3.1 Brand Color (no guide): max = 6.

## PROTOCOL 16 - Verbatim Evidence Standard
Any copy error: quote exact verbatim text with location.

---

# DEFAULT BASELINE
Demographics: US adults 25-54, mixed gender, middle income
Expertise: General consumer. F-K benchmark: Grade 6-8
Reading direction: LTR. F-Pattern for text-heavy; Z-Pattern for visual-first
Cultural context: US mainstream, low-to-mid context, individualist
Occasion: Always-on awareness. No seasonal urgency
Traffic source: Mixed cold paid social + warm retargeting
Awareness stage: Solution Aware
Brand positioning: Mid-market, trustworthy, professional
Device: Mixed desktop/mobile
Heatmap: None. Score by visual inference
`;
