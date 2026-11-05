# vegas1337/d.ai.y — Specification

**VERBINDLICH (SPEC)**

This is the single binding document of vegas1337/d.ai.y. A sentence belongs here when its violation would be a defect;
everything else — how something is built, what was measured, what is planned — belongs elsewhere and does not bind.

No section of this file is written by hand. Each change is proposed as an entry of a change queue in
`docs/spec-freigaben/`, shown beside the text it would replace, and written here only after a person has accepted it
by an approval record in `docs/approvals/`.

**Form of a requirement:** a **name** in bold capitals, which is its identifier and never changes, followed by its
**source** in italics in parentheses; on the next line its **rule**, one statement that can be shown to hold or not to
hold; then a line beginning with `*Check:*` that names the test guarding the rule, or says that it is checked only at
review. A rule that states two things is two requirements.

## Requirements
