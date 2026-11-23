# Error-correction chain example (arxiv 2311.08516).
#
# "LLMs Cannot Find Reasoning Errors, But Can Correct Them" shows that a model
# is much better at *correcting* an answer than at *locating* the exact faulty
# step. This example runs the generate -> verify -> correct loop over a problem
# and an optional candidate answer, then prints the corrected answer.
#
# Usage:
#   arakoo <this-dir>/jsonnet/main.jsonnet \
#       --ext-str problem="What is 12 * 12 + 3?" \
#       --ext-str candidate_answer="140" \
#       --ext-str openai_api_key="sk-..."

local problem = std.extVar("problem");
local candidateAnswer =
  if std.objectHas(std.extVar("__all"), "candidate_answer")
  then std.extVar("candidate_answer")
  else "";

local key = std.extVar("openai_api_key");

local main() =
  local response = arakoo.native("errorCorrection")({
      problem: problem,
      candidateAnswer: candidateAnswer,
      openAIApiKey: key,
      maxIterations: 3,
  });
  response;

main()
