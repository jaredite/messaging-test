const STORAGE_KEY = "messagingTestStateV1";

const defaultState = {
  users: ["Jared", "Nate"],
  currentUser: null,
  channels: ["General", "Random"],
  activeConversation: { type: "channel", id: "General" },
  messages: {},
  tasks: [],
  hideDoneTasks: false,
};

const state = loadState();

const userSelectScreen = document.getElementById("user-select-screen");
const messagingScreen = document.getElementById("messaging-screen");
const userList = document.getElementById("user-list");
const addUserBtn = document.getElementById("add-user-btn");
const switchUserBtn = document.getElementById("switch-user-btn");
const channelsList = document.getElementById("channels-list");
const dmList = document.getElementById("dm-list");
const conversationTitle = document.getElementById("conversation-title");
const currentUserDisplay = document.getElementById("current-user-display");
const messagesEl = document.getElementById("messages");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const tasksList = document.getElementById("tasks-list");
const hideDoneToggle = document.getElementById("hide-done-toggle");
const messageTemplate = document.getElementById("message-template");

init();

function init() {
  attachEvents();
  render();
}

function attachEvents() {
  addUserBtn.addEventListener("click", addUser);
  switchUserBtn.addEventListener("click", () => {
    state.currentUser = null;
    saveState();
    render();
  });

  messageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = messageInput.value.trim();
    if (!text || !state.currentUser) {
      return;
    }

    const key = conversationKey(state.activeConversation);
    const message = {
      id: uid(),
      sender: state.currentUser,
      text,
      sentAt: new Date().toISOString(),
      reactions: {},
    };

    if (!state.messages[key]) {
      state.messages[key] = [];
    }

    state.messages[key].push(message);
    messageInput.value = "";
    saveState();
    renderMessages();
  });

  hideDoneToggle.addEventListener("change", (event) => {
    state.hideDoneTasks = event.target.checked;
    saveState();
    renderTasks();
  });
}

function render() {
  hideDoneToggle.checked = !!state.hideDoneTasks;
  if (state.currentUser) {
    userSelectScreen.classList.remove("active");
    messagingScreen.classList.add("active");
    currentUserDisplay.textContent = `Messaging as ${state.currentUser}`;
    renderNav();
    renderMessages();
    renderTasks();
  } else {
    messagingScreen.classList.remove("active");
    userSelectScreen.classList.add("active");
    renderUserList();
  }
}

function renderUserList() {
  userList.innerHTML = "";
  state.users.forEach((user) => {
    const btn = document.createElement("button");
    btn.className = "user-btn";
    btn.textContent = user;
    btn.addEventListener("click", () => {
      state.currentUser = user;
      ensureValidConversation();
      saveState();
      render();
    });
    userList.appendChild(btn);
  });
}

function renderNav() {
  channelsList.innerHTML = "";
  dmList.innerHTML = "";

  state.channels.forEach((channel) => {
    channelsList.appendChild(
      createNavItem(`# ${channel}`, { type: "channel", id: channel })
    );
  });

  state.users
    .filter((user) => user !== state.currentUser)
    .forEach((user) => {
      dmList.appendChild(createNavItem(user, { type: "dm", id: user }));
    });
}

function createNavItem(label, conversation) {
  const item = document.createElement("div");
  item.className = "nav-item";
  if (
    state.activeConversation.type === conversation.type &&
    state.activeConversation.id === conversation.id
  ) {
    item.classList.add("active");
  }
  item.textContent = label;
  item.addEventListener("click", () => {
    state.activeConversation = conversation;
    saveState();
    renderNav();
    renderMessages();
  });
  return item;
}

function renderMessages() {
  ensureValidConversation();
  const key = conversationKey(state.activeConversation);
  const titlePrefix = state.activeConversation.type === "channel" ? "#" : "DM:";
  conversationTitle.textContent = `${titlePrefix} ${state.activeConversation.id}`;

  messagesEl.innerHTML = "";
  const conversationMessages = state.messages[key] || [];

  if (!conversationMessages.length) {
    messagesEl.innerHTML = '<p class="empty">No messages yet.</p>';
    return;
  }

  conversationMessages.forEach((message) => {
    const fragment = messageTemplate.content.cloneNode(true);
    const wrapper = fragment.querySelector(".message-item");
    const meta = fragment.querySelector(".message-meta");
    const content = fragment.querySelector(".message-content");
    const reactions = fragment.querySelector(".message-reactions");
    const actions = fragment.querySelector(".message-actions");

    meta.textContent = `${message.sender} • ${formatTime(message.sentAt)}`;
    content.textContent = message.text;

    Object.entries(message.reactions || {}).forEach(([emoji, count]) => {
      const pill = document.createElement("span");
      pill.className = "reaction-pill";
      pill.textContent = `${emoji} ${count}`;
      reactions.appendChild(pill);
    });

    actions.addEventListener("click", (event) => {
      const target = event.target.closest("button[data-action]");
      if (!target) {
        return;
      }
      const action = target.dataset.action;
      if (action === "delete") {
        deleteMessage(message.id);
      } else if (action === "task") {
        addTaskFromMessage(key, message.id);
      } else if (action.startsWith("react-")) {
        addReaction(key, message.id, action.replace("react-", ""));
      }
    });

    wrapper.dataset.messageId = message.id;
    messagesEl.appendChild(fragment);
  });
}

function renderTasks() {
  tasksList.innerHTML = "";

  const tasksToShow = state.tasks.filter(
    (task) => !state.hideDoneTasks || !task.done
  );

  if (!tasksToShow.length) {
    tasksList.innerHTML = '<p class="empty">No tasks added.</p>';
    return;
  }

  tasksToShow.forEach((task) => {
    const row = document.createElement("article");
    row.className = "task-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!task.done;
    checkbox.addEventListener("change", () => {
      task.done = checkbox.checked;
      saveState();
      renderTasks();
    });

    const body = document.createElement("div");
    body.className = "task-body";

    const meta = document.createElement("div");
    meta.className = "task-meta";
    meta.textContent = `${task.sender} • ${formatTime(task.sentAt)}`;

    const text = document.createElement("div");
    text.className = "task-text";
    text.textContent = task.text;

    body.append(meta, text);
    row.append(checkbox, body);
    tasksList.appendChild(row);
  });
}

function addUser() {
  const name = window.prompt("Enter new user name:")?.trim();
  if (!name) {
    return;
  }
  if (state.users.some((user) => user.toLowerCase() === name.toLowerCase())) {
    window.alert("That user already exists.");
    return;
  }

  state.users.push(name);
  saveState();
  renderUserList();
}

function deleteMessage(messageId) {
  const key = conversationKey(state.activeConversation);
  const messages = state.messages[key] || [];
  state.messages[key] = messages.filter((message) => message.id !== messageId);
  state.tasks = state.tasks.filter((task) => task.messageId !== messageId);
  saveState();
  renderMessages();
  renderTasks();
}

function addReaction(conversationKeyName, messageId, emoji) {
  const messages = state.messages[conversationKeyName] || [];
  const message = messages.find((entry) => entry.id === messageId);
  if (!message) {
    return;
  }
  if (!message.reactions) {
    message.reactions = {};
  }
  message.reactions[emoji] = (message.reactions[emoji] || 0) + 1;
  saveState();
  renderMessages();
}

function addTaskFromMessage(conversationKeyName, messageId) {
  if (state.tasks.some((task) => task.messageId === messageId)) {
    return;
  }

  const messages = state.messages[conversationKeyName] || [];
  const message = messages.find((entry) => entry.id === messageId);
  if (!message) {
    return;
  }

  state.tasks.push({
    id: uid(),
    messageId: message.id,
    text: message.text,
    sender: message.sender,
    sentAt: message.sentAt,
    done: false,
  });

  saveState();
  renderTasks();
}

function ensureValidConversation() {
  if (!state.currentUser) {
    return;
  }

  if (state.activeConversation.type === "dm") {
    if (!state.users.includes(state.activeConversation.id) || state.activeConversation.id === state.currentUser) {
      const fallbackDm = state.users.find((user) => user !== state.currentUser);
      if (fallbackDm) {
        state.activeConversation = { type: "dm", id: fallbackDm };
      } else {
        state.activeConversation = { type: "channel", id: state.channels[0] };
      }
    }
  }
}

function conversationKey(conversation) {
  if (conversation.type === "channel") {
    return `channel:${conversation.id}`;
  }

  const participants = [conversation.id, state.currentUser].sort();
  return `dm:${participants.join("|")}`;
}

function formatTime(isoTime) {
  return new Date(isoTime).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return structuredClone(defaultState);
    }
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      activeConversation: parsed.activeConversation || structuredClone(defaultState.activeConversation),
      messages: parsed.messages || {},
      tasks: parsed.tasks || [],
      users: Array.isArray(parsed.users) && parsed.users.length ? parsed.users : [...defaultState.users],
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
