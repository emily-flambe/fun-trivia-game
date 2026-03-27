export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/api/question') {
			const question = getRandomQuestion();
			return Response.json(question);
		}

		if (url.pathname === '/api/answer' && request.method === 'POST') {
			const body = await request.json<{ questionId: number; answer: number }>();
			const result = checkAnswer(body.questionId, body.answer);
			return Response.json(result);
		}

		return new Response(html(), {
			headers: { 'Content-Type': 'text/html; charset=utf-8' },
		});
	},
} satisfies ExportedHandler<Env>;

interface Question {
	id: number;
	question: string;
	options: string[];
	correctIndex: number;
}

const questions: Question[] = [
	{
		id: 1,
		question: 'What planet is known as the Red Planet?',
		options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
		correctIndex: 1,
	},
	{
		id: 2,
		question: 'What is the largest ocean on Earth?',
		options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'],
		correctIndex: 3,
	},
	{
		id: 3,
		question: 'How many bones are in the adult human body?',
		options: ['186', '206', '226', '256'],
		correctIndex: 1,
	},
	{
		id: 4,
		question: 'Which element has the chemical symbol "O"?',
		options: ['Gold', 'Osmium', 'Oxygen', 'Oganesson'],
		correctIndex: 2,
	},
	{
		id: 5,
		question: 'In what year did the Berlin Wall fall?',
		options: ['1987', '1988', '1989', '1990'],
		correctIndex: 2,
	},
];

function getRandomQuestion() {
	const q = questions[Math.floor(Math.random() * questions.length)];
	return { id: q.id, question: q.question, options: q.options };
}

function checkAnswer(questionId: number, answerIndex: number) {
	const q = questions.find((q) => q.id === questionId);
	if (!q) return { correct: false, message: 'Question not found' };
	const correct = q.correctIndex === answerIndex;
	return {
		correct,
		message: correct ? 'Correct!' : `Wrong! The answer was: ${q.options[q.correctIndex]}`,
	};
}

function html() {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fun Trivia Game</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .card { background: #1e293b; border-radius: 16px; padding: 2rem; max-width: 480px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
  h1 { text-align: center; margin-bottom: 1.5rem; color: #38bdf8; }
  #question { font-size: 1.2rem; margin-bottom: 1.5rem; line-height: 1.5; }
  .options { display: flex; flex-direction: column; gap: 0.75rem; }
  .option { background: #334155; border: 2px solid transparent; border-radius: 8px; padding: 0.75rem 1rem; cursor: pointer; font-size: 1rem; color: #e2e8f0; transition: all 0.2s; }
  .option:hover { border-color: #38bdf8; background: #3b4d66; }
  .option.correct { border-color: #22c55e; background: #14532d; }
  .option.wrong { border-color: #ef4444; background: #7f1d1d; }
  #result { text-align: center; margin-top: 1rem; font-weight: 600; min-height: 1.5em; }
  #next { display: none; margin: 1rem auto 0; background: #38bdf8; color: #0f172a; border: none; border-radius: 8px; padding: 0.6rem 1.5rem; font-size: 1rem; cursor: pointer; font-weight: 600; }
  #next:hover { background: #7dd3fc; }
</style>
</head>
<body>
<div class="card">
  <h1>Fun Trivia</h1>
  <div id="question">Loading...</div>
  <div class="options" id="options"></div>
  <div id="result"></div>
  <button id="next" onclick="loadQuestion()">Next Question</button>
</div>
<script>
let currentId = null;
async function loadQuestion() {
  document.getElementById('result').textContent = '';
  document.getElementById('next').style.display = 'none';
  const res = await fetch('/api/question');
  const data = await res.json();
  currentId = data.id;
  document.getElementById('question').textContent = data.question;
  const opts = document.getElementById('options');
  opts.innerHTML = '';
  data.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option';
    btn.textContent = opt;
    btn.onclick = () => submitAnswer(i, btn);
    opts.appendChild(btn);
  });
}
async function submitAnswer(index, btn) {
  document.querySelectorAll('.option').forEach(b => b.disabled = true);
  const res = await fetch('/api/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId: currentId, answer: index })
  });
  const data = await res.json();
  btn.classList.add(data.correct ? 'correct' : 'wrong');
  // correct answer highlight is handled server-side via the message
  document.getElementById('result').textContent = data.message;
  document.getElementById('next').style.display = 'block';
}
loadQuestion();
</script>
</body>
</html>`;
}
