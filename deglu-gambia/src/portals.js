import * as api from "./api.js";
import { mountAIReview, mountInsights } from "./ai-review.js";
import { el, field, button } from "./dom.js";
const LABEL = {
  submitted: "Submitted",
  under_review: "Under Review",
  assigned: "Assigned",
  in_progress: "In Progress",
  resolved: "Resolved",
  rejected: "Rejected",
};
const NEXT = {
  submitted: ["under_review", "assigned", "rejected"],
  under_review: ["assigned", "in_progress", "resolved", "rejected"],
  assigned: ["under_review", "in_progress", "rejected"],
  in_progress: ["under_review", "resolved", "rejected"],
  resolved: [],
  rejected: [],
};
const date = (s) => new Date(s).toLocaleString();
const select = (items, current = "", empty) => {
  const control = el(
    "select",
    {},
    empty != null ? el("option", { value: "" }, empty) : null,
    items.map(([value, label]) => el("option", { value }, label)),
  );
  control.value = current;
  return control;
};
const message = () => el("p", { role: "status", class: "feedback" });
const act = async (msg, fn) => {
  msg.textContent = "";
  try {
    await fn();
  } catch (e) {
    msg.textContent = api.explain(e);
    msg.classList.add("err");
  }
};
async function enter(app, user, admin) {
  const box = el("section", { class: "wrap" }, el("p", {}, "Loading?"));
  app.replaceChildren(box);
  if (!api.live || !user) {
    box.replaceChildren(
      el("h2", {}, "Sign in required"),
      el("a", { class: "btn", href: "#/account" }, "Sign in"),
    );
    return {};
  }
  const profile = await api.profile(user.id);
  if (!box.isConnected) return {};
  if (
    !profile?.is_active ||
    !(admin
      ? profile.role === "admin"
      : ["admin", "staff"].includes(profile.role))
  ) {
    box.replaceChildren(
      el("h2", {}, "Access restricted"),
      el(
        "p",
        {},
        admin
          ? "An active admin account is required."
          : "An active staff or admin account is required.",
      ),
    );
    return {};
  }
  box.replaceChildren();
  return { box, profile };
}

export async function staffPortal(app, user) {
  const { box, profile } = await enter(app, user, false);
  if (!box) return;
  const admin = profile.role === "admin";
  const [institutions, categories, areas] = await Promise.all([
    api.institutions(),
    api.categories(),
    api.refs(),
  ]);
  if (!box.isConnected) return;
  mountInsights(box, profile, institutions);
  const msg = message(),
    list = el("div", { class: "queue" }),
    details = el("div", { class: "report-detail" });
  const filter = select([["", "All statuses"], ...Object.entries(LABEL)], "");
  const search = el("input", {
    type: "search",
    placeholder: "Reference or title",
    "aria-label": "Search reports",
  });
  let reports = [],
    selected = null,
    detailRequest = 0;
  box.append(
    el("h2", {}, admin ? "All reports" : "Institution report queue"),
    el(
      "p",
      {},
      "Review reports, record progress, and approve safe titles for the community map. Latest 200 reports are shown.",
    ),
    el(
      "div",
      { class: "filters" },
      field("Status", filter),
      field("Search", search),
    ),
    button("Refresh queue", () => act(msg, refresh), true),
    msg,
    el("div", { class: "workspace-grid" }, list, details),
  );
  function drawList() {
    const query = search.value.trim().toLowerCase();
    const visible = reports.filter(
      (r) =>
        (!filter.value || r.status === filter.value) &&
        (!query || (r.reference + " " + r.title).toLowerCase().includes(query)),
    );
    list.replaceChildren(
      ...(visible.length
        ? visible.map((r) =>
            button(
              r.reference + " ? " + r.title + " ? " + LABEL[r.status],
              () => act(msg, () => show(r)),
              true,
            ),
          )
        : [el("p", {}, "No matching reports.")]),
    );
  }
  async function refresh() {
    reports = await api.staffReports(admin ? null : profile.institution_id);
    if (!box.isConnected) return;
    drawList();
    if (selected) {
      const r = reports.find((x) => x.id === selected);
      if (r) await show(r);
      else {
        selected = null;
        details.replaceChildren();
      }
    }
  }
  async function show(r) {
    selected = r.id;
    const request = ++detailRequest;
    details.replaceChildren(el("p", {}, "Loading report?"));
    const [history, notes] = await Promise.all([
      api.reportHistory(r.id),
      api.internalNotes(r.id),
    ]);
    if (!box.isConnected || request !== detailRequest) return;
    const feedback = message(),
      category = categories.find((c) => c.slug === r.category_slug),
      area = areas.areas.find((a) => a.id === r.area_id);
    details.replaceChildren(
      el(
        "article",
        { class: "card" },
        el("h3", {}, r.title),
        el("p", {}, r.reference + " ? " + LABEL[r.status]),
        el("p", { class: "report-description" }, r.description),
        el(
          "p",
          {},
          [category?.label, area?.name, r.landmark].filter(Boolean).join(" ? "),
        ),
        el("p", {}, "Submitted " + date(r.created_at)),
        feedback,
      ),
    );
    const card = details.firstChild;
    const mutate = (fn) =>
      act(feedback, async () => {
        await fn();
        await refresh();
      });
    mountAIReview(card,r.id,categories,async(id)=>{const candidate=await api.staffReport(id);if(!candidate)throw {code:'42501',message:'This report is no longer available in your scope.'};await show(candidate);});
    const next = [...NEXT[r.status]];
    if (admin && r.status === "resolved") next.push("in_progress");
    if (admin && r.status === "rejected") next.push("under_review");
    if (next.length) {
      const status = select(
        next.map((s) => [s, LABEL[s]]),
        next[0],
      );
      const note = el("textarea", {
        rows: 3,
        maxlength: 1000,
        placeholder: "Required when resolving or rejecting a report",
      });
      const pub = el("input", { type: "checkbox", checked: true });
      card.append(
        el("h3", {}, "Update progress"),
        field("New status", status),
        field("Progress note", note),
        el(
          "label",
          { class: "check-label" },
          pub,
          "Make this note public (resolution and rejection reasons are always public)",
        ),
        button("Save status", () =>
          mutate(async () => {
            if (
              ["resolved", "rejected"].includes(status.value) &&
              !note.value.trim()
            )
              throw {
                code: "22023",
                message: "Add a resolution note or rejection reason.",
              };
            await api.updateStatus(
              r.id,
              status.value,
              note.value.trim(),
              pub.checked,
            );
          }),
        ),
      );
    }
    card.append(
      el("h3", { class: "section-title" }, "Community visibility"),
      el(
        "p",
        {},
        "Review the title for personal information before publishing. Only the title, category, locality, approximate coordinates and status become public.",
      ),
      button(
        r.is_public ? "Remove from community map" : "Approve for community map",
        () => mutate(() => api.setVisibility(r.id, !r.is_public)),
        true,
      ),
    );
    if (admin) {
      const inst = select(
        institutions.filter((i) => i.is_active).map((i) => [i.id, i.name]),
        r.institution_id || "",
        "Choose institution",
      );
      card.append(
        field("Assign institution", inst),
        button(
          "Save assignment",
          () =>
            mutate(async () => {
              if (!inst.value)
                throw { code: "22023", message: "Choose an institution." };
              await api.assignReport(r.id, inst.value);
            }),
          true,
        ),
      );
    }
    card.append(
      el("h3", { class: "section-title" }, "Status history"),
      el(
        "ol",
        { class: "tl" },
        history.map((h) =>
          el(
            "li",
            { class: "d" },
            LABEL[h.new_status] + " ? " + date(h.created_at),
            el("div", {}, h.note || ""),
            el("small", {}, h.is_public ? "Public note" : "Internal note"),
          ),
        ),
      ),
    );
    const internal = el("textarea", { rows: 3, maxlength: 2000 });
    card.append(
      el("h3", {}, "Internal staff notes"),
      ...notes.map((n) =>
        el(
          "div",
          { class: "internal-note" },
          el("small", {}, date(n.created_at)),
          el("p", {}, n.body),
        ),
      ),
      field("New internal note (never public)", internal),
      button(
        "Add internal note",
        () =>
          mutate(async () => {
            if (!internal.value.trim())
              throw { code: "22023", message: "Write a note first." };
            await api.addInternalNote(r.id, user.id, internal.value.trim());
          }),
        true,
      ),
    );
  }
  filter.addEventListener("change", drawList);
  search.addEventListener("input", drawList);
  await refresh();
}

export async function adminPortal(app, user, invalidateRefs) {
  const { box } = await enter(app, user, true);
  if (!box) return;
  box.append(
    el("h2", {}, "Administration"),
    el(
      "p",
      {},
      "Manage access and category routing. Changes are checked by the database and recorded in the audit log.",
    ),
    el("a", { class: "btn alt", href: "#/staff" }, "Review reports"),
  );
  const body = el("div", { class: "admin-sections" });
  box.append(body);
  async function refresh() {
    const [people, institutions, categories, audit] = await Promise.all([
      api.profiles(),
      api.institutions(),
      api.categories(),
      api.auditLogs(),
    ]);
    if (!box.isConnected) return;
    body.replaceChildren();
    const instOptions = institutions
      .filter((i) => i.is_active)
      .map((i) => [i.id, i.name]);
    const peopleCard = el(
      "section",
      { class: "card" },
      el("h3", {}, "People and roles"),
      el(
        "p",
        {},
        "Latest 200 profiles. Staff must be assigned to an active institution. You cannot remove your own admin role.",
      ),
    );
    for (const person of people) {
      const role = select(
          ["citizen", "staff", "admin"].map((r) => [r, r]),
          person.role,
        ),
        inst = select(
          instOptions,
          person.institution_id || "",
          "No institution",
        );
      const feedback = message();
      const sync = () => {
        inst.disabled = role.value !== "staff";
      };
      sync();
      role.addEventListener("change", sync);
      peopleCard.append(
        el(
          "div",
          { class: "admin-row" },
          el("b", {}, person.display_name || "Unnamed user"),
          el("small", {}, person.id),
          field("Role", role),
          field("Staff institution", inst),
          button("Save role", () =>
            act(feedback, async () => {
              if (role.value === "staff" && !inst.value)
                throw {
                  code: "22023",
                  message: "Choose an institution for staff.",
                };
              await api.setRole(person.id, role.value, inst.value);
              await refresh();
            }),
          ),
          feedback,
        ),
      );
    }
    body.append(peopleCard);
    const routing = el(
      "section",
      { class: "card" },
      el("h3", {}, "Category routing"),
      el(
        "p",
        {},
        "Routing applies to new reports. Use report assignment to move existing reports.",
      ),
    );
    const categoryRow = (category, create = false) => {
      const label = el("input", { value: category.label || "", maxlength: 80 }),
        slug = el("input", {
          value: category.slug || "",
          maxlength: 40,
          pattern: "[a-z0-9_]{2,40}",
        });
      const inst = select(
          instOptions,
          category.institution_id || "",
          "Unrouted (admin queue)",
        ),
        active = el("input", {
          type: "checkbox",
          checked: create || category.is_active,
        }),
        feedback = message();
      return el(
        "div",
        { class: "admin-row" },
        create ? field("New category slug", slug) : el("b", {}, category.slug),
        field("Category label", label),
        field("Routing institution", inst),
        el("label", { class: "check-label" }, active, "Active"),
        button(create ? "Add category" : "Save routing", () =>
          act(feedback, async () => {
            if (
              label.value.trim().length < 2 ||
              (create && !/^[a-z0-9_]{2,40}$/.test(slug.value))
            )
              throw {
                code: "22023",
                message: "Enter a label and a valid category slug.",
              };
            await api.saveCategory(
              slug.value,
              {
                label: label.value.trim(),
                institution_id: inst.value || null,
                is_active: active.checked,
              },
              create,
            );
            invalidateRefs();
            await refresh();
          }),
        ),
        feedback,
      );
    };
    categories.forEach((c) => routing.append(categoryRow(c)));
    routing.append(categoryRow({}, true));
    body.append(routing);
    const config = el(
      "section",
      { class: "card" },
      el("h3", {}, "Institutions and localities"),
      el(
        "ul",
        {},
        institutions.map((i) =>
          el("li", {}, i.name + (i.is_active ? "" : " (inactive)")),
        ),
      ),
    );
    for (const [label, max, save] of [
      ["Institution", 120, api.addInstitution],
      ["Locality", 60, api.addArea],
    ]) {
      const name = el("input", { maxlength: max }),
        feedback = message();
      config.append(
        field("New " + label.toLowerCase() + " name", name),
        button("Add " + label.toLowerCase(), () =>
          act(feedback, async () => {
            if (name.value.trim().length < 2)
              throw {
                code: "22023",
                message: "Enter a name with at least 2 characters.",
              };
            await save(name.value.trim());
            invalidateRefs();
            await refresh();
          }),
        ),
        feedback,
      );
    }
    body.append(
      config,
      el(
        "section",
        { class: "card" },
        el("h3", {}, "Recent audit log"),
        el("p", {}, "Latest 100 configuration and access changes."),
        ...(audit.length
          ? audit.map((a) =>
              el(
                "div",
                { class: "audit-row" },
                date(a.created_at) + " ? " + a.action + " ? " + a.target_table,
                el("small", {}, a.target_id || ""),
              ),
            )
          : [el("p", {}, "No audit entries yet.")]),
      ),
    );
  }
  await refresh();
}
