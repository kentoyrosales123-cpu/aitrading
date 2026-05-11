const cards = document.getElementById("cards");
const updated = document.getElementById("updated");

function showPage(pageId) {
  ["homePage", "loginPage", "registerPage", "terminalPage"].forEach((id) => {
    const page = document.getElementById(id);
    if (page) page.classList.add("hidden");
  });

  const selectedPage = document.getElementById(pageId);
  if (selectedPage) selectedPage.classList.remove("hidden");

  if (pageId === "terminalPage" && typeof changeSymbol === "function") {
    setTimeout(() => changeSymbol(currentSymbol || "BINANCE:BTCUSDT"), 300);
  }
}

function registerUser(event) {
  event.preventDefault();

  const user = {
    name: document.getElementById("registerName").value.trim(),
    email: document.getElementById("registerEmail").value.trim(),
    password: document.getElementById("registerPassword").value,
  };

  localStorage.setItem("cryptoAiUser", JSON.stringify(user));
  localStorage.setItem("cryptoAiLoggedIn", "true");

  showPage("terminalPage");
}

function loginUser(event) {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const savedUser = JSON.parse(localStorage.getItem("cryptoAiUser") || "null");

  if (!savedUser) {
    alert("No account found. Please register first.");
    showPage("registerPage");
    return;
  }

  if (savedUser.email !== email || savedUser.password !== password) {
    alert("Invalid email or password.");
    return;
  }

  localStorage.setItem("cryptoAiLoggedIn", "true");
  showPage("terminalPage");
}

function logoutUser() {
  localStorage.removeItem("cryptoAiLoggedIn");
  showPage("homePage");
}

document.addEventListener("DOMContentLoaded", () => {
  const loggedIn = localStorage.getItem("cryptoAiLoggedIn") === "true";
  showPage(loggedIn ? "terminalPage" : "homePage");
});

async function loadCrypto() {
  if (!cards || !updated) return;

  try {
    updated.textContent = "Updating market data...";

    const res = await fetch("/api/crypto");
    const data = await res.json();

    cards.innerHTML = "";

    data.forEach((item) => {
      const trendClass = item.trend.toLowerCase();

      cards.innerHTML += `
        <div class="card">
          <div class="coin">
            <h2>${item.coin}</h2>
            <span class="badge ${trendClass}">${item.trend}</span>
          </div>

          <div class="price">$${Number(item.price).toLocaleString()}</div>
          <div class="change">${item.change}% in 24h</div>

          <div class="details">
            <p>Support: <span>$${item.support}</span></p>
            <p>Resistance: <span>$${item.resistance}</span></p>
            <p>Signal: <span>${item.signal}</span></p>
          </div>
        </div>
      `;
    });

    updated.textContent = `Last updated: ${new Date().toLocaleString()}`;
  } catch (error) {
    updated.textContent = "Failed to load crypto data.";
  }
}

if (cards && updated) {
  loadCrypto();
  setInterval(loadCrypto, 15 * 60 * 1000);
}
