async function loadLeaderboard() {
  const response = await fetch("./data/leaderboard.json");
  const data = await response.json();

  const lastUpdated = document.getElementById("last-updated");
  const tbody = document.getElementById("leaderboard-body");

  lastUpdated.textContent = data.last_updated
    ? `Last updated: ${data.last_updated}`
    : "No data loaded yet.";

  tbody.innerHTML = "";

  data.leaderboard.forEach((row, index) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${row.participant}</td>
      <td>${row.confirmed_points}</td>
      <td>${row.live_projected_points}</td>
      <td>${row.exact_scores}</td>
      <td>${row.correct_results}</td>
    `;

    tbody.appendChild(tr);
  });
}

loadLeaderboard();
setInterval(loadLeaderboard, 60000);