const coins = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
  binancecoin: "BNB",
  ripple: "XRP",
};

async function getCryptoPrices() {
  try {
    const ids = Object.keys(coins).join(",");

    const url =
      `https://api.coingecko.com/api/v3/simple/price` +
      `?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

    const res = await fetch(url);
    const data = await res.json();

    console.clear();

    console.log("=================================");
    console.log("   CRYPTO MARKET LIVE MONITOR");
    console.log("=================================");
    console.log(`Updated: ${new Date().toLocaleString()}\n`);

    const table = [];

    for (const id of Object.keys(coins)) {
      const symbol = coins[id];

      const price = data[id]?.usd || 0;
      const change = data[id]?.usd_24h_change || 0;

      let trend = "Sideways";
      let signal = "Watch";

      if (change > 2) {
        trend = "Bullish";
        signal = change > 5 ? "Take Profit" : "Watch";
      } else if (change < -2) {
        trend = "Bearish";
        signal = change < -5 ? "High Risk" : "Buy Zone";
      }

      const support = (price * 0.97).toFixed(2);
      const resistance = (price * 1.03).toFixed(2);

      table.push({
        Coin: symbol,
        Price: `$${price.toLocaleString()}`,
        Change24h: `${change.toFixed(2)}%`,
        Trend: trend,
        Support: `$${support}`,
        Resistance: `$${resistance}`,
        Signal: signal,
      });

      // Alert system
      if (change >= 5) {
        console.log(`🚀 ALERT: ${symbol} pumped above 5%`);
      }

      if (change <= -5) {
        console.log(`⚠️ ALERT: ${symbol} dumped below -5%`);
      }
    }

    console.table(table);

    console.log("\nMarket Summary:");
    console.log("- Live data powered by CoinGecko API");
    console.log("- Monitoring volatility and momentum");
    console.log("- Support/resistance are estimated zones");

    console.log("\nRisk Warning:");
    console.log("Crypto is highly volatile. This is not financial advice.");

    console.log("\n⏳ Waiting for next update...");
  } catch (error) {
    console.error("Error fetching crypto data:", error.message);
  }
}

// Run immediately
getCryptoPrices();

// Auto-update every 15 minutes
setInterval(getCryptoPrices, 15 * 60 * 1000);
