# Task Plan: Fix Lighthouse Issues and Migrate Targeted Styles to Tailwind

## Goal
Resolve the Lighthouse findings (layout shift, forced reflow, LCP render delay, missing labels/landmarks, touch target sizing, heading order) using Tailwind utility classes instead of custom CSS, while keeping the page usable and responsive.

## Current Phase
Phase 4

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define technical approach
- [x] Identify markup sections to update for a11y and CLS
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
- [x] Update markup to add main landmark, labels, heading order fixes
- [x] Reduce CLS with reserved space and stable sizing
- [x] Replace targeted custom styles with Tailwind utilities
- **Status:** complete

### Phase 4: Testing & Verification
- [ ] Verify requirements met
- [ ] Document test results in progress.md
- [ ] Fix any issues found
- **Status:** in_progress

### Phase 5: Delivery
- [ ] Review all output files
- [ ] Ensure deliverables are complete
- [ ] Deliver to user
- **Status:** pending

## Key Questions
1. Is Tailwind already installed/configured, or should I add minimal setup files and leave install to user?
2. Which Lighthouse issues can be addressed with markup-only changes versus needing CSS or JS changes?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use Tailwind utility classes for new/updated UI bits and minimize custom CSS changes | User request to use Tailwind and avoid bespoke CSS |
| Prioritize a11y fixes (labels, main landmark, heading order) and CLS stabilizers | Direct Lighthouse warnings and low-risk changes |
| Add Tailwind config + global CSS import without removing existing component styles | Enables Tailwind utilities while avoiding large refactor |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
- Need to check Tailwind availability and decide on setup scope before large refactor.
