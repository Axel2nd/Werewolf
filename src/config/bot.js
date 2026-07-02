// Removed unused logger import (bug #4 fix)

export const BotConfig = {
  // =========================
  // BOT PRESENCE (what users see under the bot name)
  // =========================
  presence: {
    status: "online",

    // Activity type: 0=Playing 1=Streaming 2=Listening 3=Watching 4=Custom 5=Competing
    // BUG FIX #3: Changed type from 1 (Streaming, requires url) to 3 (Watching)
    activities: [
      {
        name: "VOID SERVER",
        type: 3,
      },
    ],
  },

  // =========================
  // COMMAND BEHAVIOR
  // =========================
  commands: {
    owners: process.env.OWNER_IDS?.split(",").map(id => id.trim()).filter(Boolean) || [],
    defaultCooldown: 3,
    deleteCommands: false,
    testGuildId: process.env.TEST_GUILD_ID || null,
    prefix: process.env.PREFIX || "!",
  },

  // =========================
  // APPLICATIONS SYSTEM
  // =========================
  applications: {
    defaultQuestions: [
      { question: "What is your name?", required: true },
      { question: "How old are you?", required: true },
      { question: "Why do you want to join?", required: true },
    ],
    statusColors: {
      pending: "#FFA500",
      approved: "#00FF00",
      denied: "#FF0000",
    },
    applicationCooldown: 24,
    deleteDeniedAfter: 7,
    deleteApprovedAfter: 30,
    managerRoles: [],
  },

  // =========================
  // EMBED COLORS & BRANDING
  // =========================
  embeds: {
    colors: {
      primary: "#336699",
      secondary: "#2F3136",
      success: "#57F287",
      error: "#ED4245",
      warning: "#FEE75C",
      info: "#3498DB",
      light: "#FFFFFF",
      dark: "#202225",
      gray: "#99AAB5",
      blurple: "#5865F2",
      green: "#57F287",
      yellow: "#FEE75C",
      fuchsia: "#EB459E",
      red: "#ED4245",
      black: "#000000",
      giveaway: {
        active: "#57F287",
        ended: "#ED4245",
      },
      ticket: {
        open: "#57F287",
        claimed: "#FAA61A",
        closed: "#ED4245",
        pending: "#99AAB5",
      },
      economy: "#F1C40F",
      birthday: "#E91E63",
      moderation: "#9B59B6",
      priority: {
        none: "#95A5A6",
        low: "#3498db",
        medium: "#2ecc71",
        high: "#f1c40f",
        urgent: "#e74c3c",
      },
      werewolf: {
        lobby:    "#5865F2",
        night:    "#1A1A2E",
        day:      "#F4A261",
        voting:   "#E76F51",
        werewolf: "#C0392B",
        village:  "#27AE60",
        special:  "#8E44AD",
        dead:     "#636E72",
        win:      "#F1C40F",
      },
    },
    footer: {
      text: "Titan Bot",
      icon: null,
    },
    thumbnail: null,
    author: {
      name: null,
      icon: null,
      url: null,
    },
  },

  // =========================
  // ECONOMY SETTINGS
  // =========================
  economy: {
    currency: {
      name: "coins",
      namePlural: "coins",
      symbol: "$",
    },
    startingBalance: 0,
    baseBankCapacity: 100000,
    dailyAmount: 100,
    workMin: 10,
    workMax: 100,
    begMin: 5,
    begMax: 50,
    robSuccessRate: 0.4,
    robFailJailTime: 3600000,
  },

  // =========================
  // SHOP SETTINGS
  // =========================
  shop: {},

  // =========================
  // TICKET SYSTEM
  // =========================
  tickets: {
    defaultCategory: null,
    supportRoles: [],
    priorities: {
      none:   { emoji: "⚪", color: "#95A5A6", label: "None" },
      low:    { emoji: "🟢", color: "#2ECC71", label: "Low" },
      medium: { emoji: "🟡", color: "#F1C40F", label: "Medium" },
      high:   { emoji: "🔴", color: "#E74C3C", label: "High" },
      urgent: { emoji: "🚨", color: "#E91E63", label: "Urgent" },
    },
    defaultPriority: "none",
    archiveCategory: null,
    logChannel: null,
  },

  // =========================
  // GIVEAWAY SETTINGS
  // =========================
  giveaways: {
    defaultDuration: 86400000,
    minimumWinners: 1,
    maximumWinners: 10,
    minimumDuration: 300000,
    maximumDuration: 2592000000,
    allowedRoles: [],
    bypassRoles: [],
  },

  // =========================
  // BIRTHDAY SETTINGS
  // =========================
  birthday: {
    defaultRole: null,
    announcementChannel: null,
    timezone: "UTC",
  },

  // =========================
  // VERIFICATION SETTINGS
  // =========================
  verification: {
    defaultMessage: "Click the button below to verify yourself and gain access to the server!",
    defaultButtonText: "Verify",
    autoVerify: {
      defaultCriteria: "none",
      defaultAccountAgeDays: 7,
      serverSizeThreshold: 1000,
      minAccountAge: 1,
      maxAccountAge: 365,
      sendDMNotification: true,
      criteria: {
        account_age: "Account must be older than specified days",
        server_size: "All users if server has less than 1000 members",
      },
    },
  },
};

// =========================
// BUG FIX #2: validateConfig function (was imported by application.js but missing)
// =========================
export function validateConfig(config) {
  const required = ['DISCORD_TOKEN', 'CLIENT_ID'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return true;
}

// =========================
// BUG FIX #1: Default export (application.js imports this as default)
// =========================
export default botConfig;
