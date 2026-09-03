const QUESTION_CALLBACK_PATTERN = /^cq:(answer|dismiss|publish|hide):(\d+)$/;

function parseQuestionCallback(data) {
  const match = QUESTION_CALLBACK_PATTERN.exec(data || "");

  if (!match) {
    return null;
  }

  return { action: match[1], questionId: Number(match[2]) };
}

module.exports = { parseQuestionCallback };
