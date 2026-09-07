// Use the same command menus as a player; no direct calls into game state.
export async function battleMenu(page, menu) {
  const panel = menu === "fight" ? "#move-buttons" : "#battle-actions";
  if (await page.locator(panel).isVisible()) return;
  if (await page.locator("#battle-back").isVisible()) await page.click("#battle-back");
  await page.click(menu === "fight" ? "#fight-btn" : "#bag-btn");
}
