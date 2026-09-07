// Interface chrome only. The world and all image/model assets remain Blender authored.
export function mountPhone() {
  const device = document.createElement("aside");
  device.id = "phone";
  device.setAttribute("aria-label", "Mum's old phone");
  device.innerHTML = `<div class="phone-hardware"><div class="phone-speaker"></div><div class="phone-status"><span>05:17</span><span class="phone-signal">▂▄▆ &nbsp; 83 ▰</span></div><div class="phone-appbar"><button id="phone-back" aria-label="Back">‹</button><div><strong id="phone-app-title">COUNTY LEAGUE</strong><small id="phone-app-subtitle">MUM'S OLD PHONE</small></div><button id="phone-home" aria-label="Phone home">⌂</button></div><div id="phone-screen"></div><button id="phone-home-bar" aria-label="Return to phone home"><span></span></button></div>`;
  document.body.appendChild(device);
  const screen = device.querySelector("#phone-screen");
  const home = document.createElement("section");
  home.id = "title-app";
  home.className = "phone-page";
  home.innerHTML = `<div class="league-app-icon">OA<span>COUNTY LEAGUE</span></div><h2>YOUR JOURNEY.<br>THEIR LIABILITY.</h2><p class="phone-welcome">Competitive animal handling.<br>Now available to children.</p>`;
  home.appendChild(document.querySelector(".title-menu"));
  home.appendChild(document.getElementById("save-summary"));
  home.appendChild(document.getElementById("loading-status"));
  screen.appendChild(home);
  for (const id of [
    "registration",
    "settings-panel",
    "dialogue",
    "choose",
    "battle",
    "journal",
    "ending",
  ]) {
    const page = document.getElementById(id);
    page.classList.add("phone-page");
    screen.appendChild(page);
  }
  return {
    update({ playing, modal, battle, tab, speaker }) {
      device.hidden = playing && !modal && !battle;
      home.hidden = playing || Boolean(modal);
      device.classList.toggle("in-battle", Boolean(battle));
      device.classList.toggle("on-title", !playing);
      document.body.classList.toggle("phone-open", !device.hidden);
      const names = {
        registration: ["NEW APPLICANT", "AGE CHECK: UNFORTUNATELY ELIGIBLE"],
        "settings-panel": ["SETTINGS", "PARENTAL CONTROLS: NOT SET UP"],
        dialogue: ["MESSAGES", "COUNCIL RESEARCH GROUP"],
        choose: ["ANIMAL INTAKE", "COLLECT IN PERSON · NO DELIVERY"],
        journal: ["LEAGUE APPS", "LOCATION SHARED WITH NOBODY"],
        ending: ["CERTIFICATE", "STILL TOO YOUNG TO ACCEPT THE TERMS"],
      };
      const apps = {
        apps: ["HOME", "MUM'S OLD PHONE"],
        contacts: ["MESSAGES", "3 CONTACTS · ALL YOU HAVE"],
        bag: ["BAG", "PACKED BY MUM · CARRIED BY YOU"],
        map: ["MAPS", "COUNTY LEAGUE BUS NETWORK"],
        party: ["ANIMALS", "THEY ARE YOUR RESPONSIBILITY NOW"],
        register: ["REGISTER", "REAL ANIMALS · OFFICIAL NUMBERS"],
        guide: ["LEAGUE GUIDE", "THE TERMS WERE WRITTEN BY ADULTS"],
      };
      const context =
        modal === "journal"
          ? apps[tab]
          : modal === "dialogue" && speaker?.includes("MUM")
            ? ["MUM", "SMS · AT WORK"]
            : null;
      const [title, subtitle] =
        context ||
        names[modal] ||
        (battle
          ? ["LIVE BATTLE", "AN ADULT HAS AUTHORISED THIS"]
          : ["COUNTY LEAGUE", "MUM'S OLD PHONE"]);
      document.getElementById("phone-app-title").textContent = title;
      document.getElementById("phone-app-subtitle").textContent = subtitle;
      if (modal) document.getElementById("battle").hidden = true;
      else if (battle) document.getElementById("battle").hidden = false;
    },
  };
}
