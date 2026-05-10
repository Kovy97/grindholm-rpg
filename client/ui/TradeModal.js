import { api } from "../api.js";

// OSRS-style trade modal — opens on right-click → Trade on a trader NPC.
// Shows a list of stock items with buy buttons; current player gp top-right.
export class TradeModal {
  constructor({ root, gameClient }) {
    this._root = root;
    this._game = gameClient;
    this._npcId = null;
    this._offers = [];
    this._build();
  }

  _build() {
    this._root.innerHTML = `
      <div class="trade-panel">
        <div class="trade-header">
          <h2 class="trade-title">Trader</h2>
          <span class="trade-gold">0 gp</span>
          <button class="trade-close">close (ESC)</button>
        </div>
        <div class="trade-list"></div>
      </div>
    `;
    this._root.querySelector(".trade-close").addEventListener("click", () => this.close());
    this._root.addEventListener("mousedown", (e) => {
      // dismiss when clicking the dim overlay outside the panel
      if (e.target === this._root) this.close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this._root.classList.contains("hidden")) this.close();
    });
  }

  async open(npc) {
    this._npcId = npc.id;
    this._root.querySelector(".trade-title").textContent = npc.name;
    this._root.classList.remove("hidden");
    try {
      this._offers = await api.getTradeOffers(npc.id);
    } catch (err) {
      this._game.toast("Trade offers unavailable.", "error");
      this._offers = [];
    }
    this.render();
  }

  close() {
    this._root.classList.add("hidden");
    this._npcId = null;
  }

  render() {
    const list = this._root.querySelector(".trade-list");
    const goldEl = this._root.querySelector(".trade-gold");
    const gold = this._game.state?.player?.inventory?.gold ?? 0;
    if (goldEl) goldEl.textContent = `${gold.toLocaleString()} gp`;
    list.innerHTML = "";
    for (const offer of this._offers) {
      const row = document.createElement("div");
      row.className = "trade-row";
      const canAfford = gold >= offer.price;
      row.innerHTML = `
        <div class="icon" style="background:${offer.color || "#888"}"></div>
        <div class="name">${offer.name}</div>
        <div class="price">${offer.price === 0 ? "free" : offer.price.toLocaleString() + " gp"}</div>
        <button data-buy="1" ${canAfford ? "" : "disabled"}>Buy 1</button>
        <button data-buy="10" ${canAfford ? "" : "disabled"}>×10</button>
      `;
      const buy = async (count) => {
        const r = await api.tradeBuy(this._npcId, offer.item_id, count);
        if (r?.ok) this._game.toast(r.message, "success");
        else this._game.toast(r?.message || "purchase failed", "error");
        await this._game.refreshState();
        this.render();
      };
      row.querySelector('[data-buy="1"]').addEventListener("click", () => buy(1));
      row.querySelector('[data-buy="10"]').addEventListener("click", () => buy(10));
      list.appendChild(row);
    }
  }
}
