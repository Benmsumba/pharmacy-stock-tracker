"use strict";

const DAY = 86_400_000;
const key = "pharmacy-stock-demo-v1";
const filter = document.querySelector("#filter");
const rows = document.querySelector("#rows");
const editor = document.querySelector("#editor");
const form = document.querySelector("#batch-form");
const notice = document.querySelector("#notice");
const summary = document.querySelector("#summary");
const labels = { low: "Low stock", soon: "Expiring soon", expired: "Expired" };
let editing = null;

function today() {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

function sampleDate(offset) {
  return new Date(today() + offset * DAY).toISOString().slice(0, 10);
}

function sampleBatches() {
  return [
    { item: "Sample tablets A", batch: "DEMO-01", quantity: 6, expiry: sampleDate(90) },
    { item: "Sample capsules B", batch: "DEMO-02", quantity: 24, expiry: sampleDate(12) },
    { item: "Sample solution C", batch: "DEMO-03", quantity: 16, expiry: sampleDate(-4) },
  ];
}

function loadBatches() {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (Array.isArray(saved) && saved.every(batch =>
      batch && typeof batch.item === "string" && typeof batch.batch === "string" &&
      Number.isInteger(batch.quantity) && batch.quantity >= 0 &&
      typeof batch.expiry === "string" && /^\d{4}-\d{2}-\d{2}$/.test(batch.expiry) &&
      Number.isFinite(Date.parse(batch.expiry))
    )) return saved;
  } catch {
    // A fresh demo remains usable when storage is unavailable.
  }
  return sampleBatches();
}

const batches = loadBatches();

function statuses(batch, currentDay) {
  const days = (Date.parse(batch.expiry) - currentDay) / DAY;
  const result = [];
  if (batch.quantity <= 10) result.push("low");
  if (days < 0) result.push("expired");
  else if (days <= 30) result.push("soon");
  return result;
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function render() {
  const currentDay = today();
  const entries = batches.map((batch, index) => ({ batch, index, flags: statuses(batch, currentDay) }));
  summary.replaceChildren();
  for (const [flag, label] of Object.entries({ all: "Total batches", ...labels })) {
    const metric = element("div", undefined, "metric");
    const count = flag === "all" ? entries.length : entries.filter(entry => entry.flags.includes(flag)).length;
    metric.append(element("strong", count), element("span", label));
    summary.append(metric);
  }
  const visible = entries.filter(entry => filter.value === "all" || entry.flags.includes(filter.value));
  rows.replaceChildren();
  for (const { batch, index, flags } of visible) {
    const row = element("tr");
    row.append(...[batch.item, batch.batch, batch.quantity, batch.expiry].map(value => element("td", value)));
    const status = element("td");
    if (!flags.length) status.append(element("span", "OK", "badge"));
    for (const flag of flags) status.append(element("span", labels[flag], "badge " + flag));
    const action = element("td");
    const edit = element("button", "Edit", "secondary");
    edit.type = "button";
    edit.setAttribute("aria-label", "Edit " + batch.batch);
    edit.addEventListener("click", () => openEditor(index));
    action.append(edit);
    row.append(status, action);
    rows.append(row);
  }
  if (!visible.length) {
    const row = element("tr");
    const cell = element("td", "No batches match this filter.");
    cell.colSpan = 6;
    row.append(cell);
    rows.append(row);
  }
}

function openEditor(index) {
  editing = index;
  form.reset();
  form.elements.namedItem("batch").setCustomValidity("");
  document.querySelector("#form-title").textContent = index === null ? "Add batch" : "Edit batch";
  if (index !== null) {
    for (const [name, value] of Object.entries(batches[index])) form.elements.namedItem(name).value = value;
  }
  editor.showModal();
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(form);
  const batch = {
    item: data.get("item").trim(),
    batch: data.get("batch").trim(),
    quantity: Number(data.get("quantity")),
    expiry: data.get("expiry"),
  };
  if (!batch.item || !batch.batch) {
    const field = form.elements.namedItem(batch.item ? "batch" : "item");
    field.setCustomValidity("Enter a value other than spaces.");
    field.reportValidity();
    return;
  }
  if (batches.some((entry, index) => index !== editing && entry.batch.toLowerCase() === batch.batch.toLowerCase())) {
    form.elements.namedItem("batch").setCustomValidity("This batch code is already in use.");
    form.elements.namedItem("batch").reportValidity();
    return;
  }
  if (editing === null) batches.push(batch);
  else batches[editing] = batch;
  try {
    localStorage.setItem(key, JSON.stringify(batches));
    notice.textContent = "Batch saved in this browser.";
  } catch {
    notice.textContent = "Batch updated for this session. Browser storage is unavailable.";
  }
  editor.close();
  render();
});

form.addEventListener("input", event => event.target.setCustomValidity(""));
document.querySelector("#add").addEventListener("click", () => openEditor(null));
document.querySelector("#cancel").addEventListener("click", () => editor.close());
filter.addEventListener("change", render);
render();
