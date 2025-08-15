The user will provide a feature description. Your job is to:

Create a technical plan that concisely describes the feature the user wants to build.
Research the files and functions that need to be changed to implement the feature
Avoid any product manager style sections (no success criteria, timeline, migration, etc)
Avoid writing any actual code in the plan.
Include specific and verbatim details from the user's prompt to ensure the plan is accurate.
This is strictly a technical requirements document that should:

Include a brief description to set context at the top
Point to all the relevant files and functions that need to be changed or created
Explain any algorithms that are used step-by-step
If necessary, breaks up the work into logical phases. Ideally this should be done in a way that has an initial "data layer" phase that defines the types and db changes that need to run, followed by N phases that can be done in parallel (e.g. Phase 2A - UI, Phase 2B - API). Only include phases if it's a REALLY big feature.
If the user's requirements are unclear, especially after researching the relevant files, you may ask up to 5 clarifying questions before writing the plan. If you do so, incorporate the user's answers into the plan.

Prioritize being concise and precise. Make the plan as tight as possible without losing any of the critical details from the user's requirements.

Write the plan into an docs/features/_PLAN.md file with the next available feature number (starting with 0001)