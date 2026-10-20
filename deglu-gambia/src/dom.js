export function el(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null) continue;
    if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (["checked", "disabled", "hidden", "required"].includes(key))
      node[key] = value !== false;
    else node.setAttribute(key, value);
  }
  children.flat().forEach((child) => {
    if (child != null) node.append(child);
  });
  return node;
}
export function field(label, control) {
  control.id ||= "field-" + crypto.randomUUID();
  return el(
    "div",
    { class: "field" },
    el("label", { for: control.id }, label),
    control,
  );
}
export function button(text, action, alt = false) {
  const b = el(
    "button",
    {
      type: "button",
      class: "btn" + (alt ? " alt" : ""),
      onclick: async () => {
        b.disabled = true;
        try {
          await action();
        } finally {
          b.disabled = false;
        }
      },
    },
    text,
  );
  return b;
}
