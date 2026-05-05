import {
  BC_THEMES,
  type BcTheme,
  THEME_LABELS,
  getStoredTheme,
  setStoredTheme
} from "../../content/design";

export async function initThemePicker(): Promise<void> {
  const root = document.getElementById("theme-row");
  if (!(root instanceof HTMLElement)) return;
  root.innerHTML = "";

  const label = document.createElement("label");
  label.className = "ctec-school-label";
  label.htmlFor = "theme-select";

  const labelTitle = document.createElement("span");
  labelTitle.className = "ctec-school-label-title";
  labelTitle.textContent = "Theme";

  const labelHelp = document.createElement("span");
  labelHelp.className = "ctec-school-label-help";
  labelHelp.textContent =
    "Pick the design system theme. Reload pages to apply.";

  label.append(labelTitle, labelHelp);

  const select = document.createElement("select");
  select.id = "theme-select";
  select.className = "ctec-school-select";
  for (const theme of BC_THEMES) {
    const option = document.createElement("option");
    option.value = theme;
    option.textContent = THEME_LABELS[theme];
    select.appendChild(option);
  }
  select.value = await getStoredTheme();
  select.addEventListener("change", () => {
    void setStoredTheme(select.value as BcTheme);
  });

  root.append(label, select);
}
