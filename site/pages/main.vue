<template>
  <v-sheet
    color="#0049bd"
    width="100%"
    min-height="100vh"
    max-height="100vh"
    class="d-flex flex-column pa-3"
  >
    <!-- ************************************************************* -->
    <!-- DIALOG TO REFRESH ON VERSION MISMATCH -->
    <!-- ************************************************************* -->
    <v-dialog v-model="refreshDialog" persistent max-width="300">
      <v-card>
        <v-card-title>
          <p class="body-1">
            There is a new version available!
          </p>
        </v-card-title>
        <v-card-actions>
          <v-spacer />
          <v-btn outlined small @click="reload">
            refresh
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ************************************************************* -->
    <!-- THE DIALOG TO START A GAME -->
    <!-- ************************************************************* -->

    <v-dialog v-model="dialog" max-width="800">
      <v-card>
        <v-toolbar flat color="#8fa5b7">
          <v-toolbar-title class="white--text pl-1">
            <strong>Start a game</strong>
          </v-toolbar-title>
          <v-spacer />
          <v-btn small outlined color="white" class="mr-3" @click="openUrl('https://help.fortee2.com/start-a-game/')">
            Help
            <v-icon right>
              mdi-open-in-new
            </v-icon>
          </v-btn>
          <v-btn small icon color="white" class="mr-1" @click="dialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <div class="px-2">
          <div class="pa-3">
            Choose other players to invite, or leave them blank to play with bots
          </div>
          <v-card-actions>
            <v-select
              v-model="left"
              dense
              hide-details
              outlined
              label="left"
              :items="otherUsers"
              clearable
              class="mr-2"
            />
            <v-select
              v-model="partner"
              dense
              hide-details
              outlined
              label="partner"
              :items="otherUsers"
              clearable
              class="mr-2"
            />
            <v-select
              v-model="right"
              dense
              hide-details
              outlined
              label="right"
              :items="otherUsers"
              clearable
            />
          </v-card-actions>
          <Rules v-model="rules" />
          <v-card-actions class="py-6">
            <div class="red--text">
              <strong>{{ error }}</strong>
            </div>
            <v-spacer />
            <v-btn
              outlined
              color="#0049bd"
              :disabled="!!error"
              :loading="loading"
              @click="play"
            >
              play
            </v-btn>
          </v-card-actions>
        </div>
      </v-card>
    </v-dialog>

    <!-- ************************************************************* -->
    <!-- TOOLBAR -->
    <!-- ************************************************************* -->
    <div class="d-flex flex-column">
      <v-sheet color="#0049bd" class="d-flex flex-row align-center">
        <v-img contain max-height="36" max-width="300" src="/logo-tight.png" />
        <span class="caption white--text ml-2 align-self-end">
          <strong>{{ $config.version }}</strong>
        </span>
        <!-- <v-btn @click="screenShot">ss</v-btn> -->
        <v-spacer />
        <v-toolbar-title v-if="you.name" class="white--text">
          <strong>Hi, {{ myName }}</strong>
        </v-toolbar-title>
      </v-sheet>
      <!-- ************************************************************* -->
      <!-- BOTTOM TOOLBAR -->
      <!-- ************************************************************* -->
      <v-sheet color="#0049bd" class="d-flex flex-row align-center white-text py-3">
        <!-- HOSTING A GAME (OR WITH BOTS) -->
        <div v-if="table.status === 'hosting'" class="d-flex flex-row">
          <span class="white--text mr-3">
            You started a game {{ tableWith() }}
          </span>
          <v-btn small color="white" class="red--text" @click="decline">
            close
            <v-icon right>
              mdi-close-circle-outline
            </v-icon>
          </v-btn>
        </div>

        <!-- INVITED TO PLAY WITH OTHERS -->
        <div v-else-if="table.status === 'invited'" class="d-flex flex-row">
          <span class="white--text mr-3">
            You have been <strong>invited</strong> to play a game {{ tableWith() }}
          </span>
          <v-btn small color="white" class="mr-3 green--text" @click="openUrl(table.url)">
            play
            <v-icon right>
              mdi-play
            </v-icon>
          </v-btn>
          <v-btn small color="white" class="red--text" @click="decline">
            decline
            <v-icon right>
              mdi-cancel
            </v-icon>
          </v-btn>
        </div>

        <!-- START A GAME -->
        <div v-else>
          <v-btn small color="white" class="align-self-center" @click="dialog = true">
            play
            <v-icon right>
              mdi-play
            </v-icon>
          </v-btn>
        </div>

        <!-- SPACER BEFORE BUTTONS ON THE RIGHT -->
        <v-spacer />

        <!-- STATS BUTTON -->
        <v-btn small outlined color="white" class="mr-3" @click="openUrl('/stats')">
          <v-icon left>
            mdi-chart-bar
          </v-icon>
          stats
        </v-btn>

        <!-- GAME REVIEW BUTTON -->
        <v-btn small outlined color="white" class="mr-3" @click="openUrl('/game-review')">
          <v-icon left>
            mdi-table-search
          </v-icon>
          games
        </v-btn>

        <!-- HELP BUTTON -->
        <v-menu
          v-model="help"
          :close-on-click="false"
          :close-on-content-click="false"
        >
          <template #activator="{ on, attrs }">
            <v-btn
              small
              outlined
              color="white"
              v-bind="attrs"
              v-on="on"
            >
              <v-icon small>
                mdi-help
              </v-icon>
            </v-btn>
          </template>
          <v-card tile max-width="400" class="pa-3">
            <div class="d-flex flex-row align-center">
              <strong>Help</strong>
              <v-spacer />
              <v-btn small icon @click="help=false">
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </div>
            <v-divider class="my-3" />
            <help />
          </v-card>
        </v-menu>

        <!-- OPEN TD PAGE BUTTON -->
        <v-btn
          v-if="you?.roles?.includes('td')"
          small
          outlined
          color="white"
          class="ml-3"
          @click="openUrl('/td')"
        >
          <v-icon small>
            mdi-cog-outline
          </v-icon>
        </v-btn>
      </v-sheet>
    </div>
    <v-sheet class="d-flex flex-row flex-grow-1" min-height="0px">
      <!-- LEFT SIDE -->
      <v-sheet color="#c0d4e5" class="d-flex flex-column pa-3">
        <v-sheet color="#c0d4e5" class="d-flex flex-column flex-grow-1 overflow-y-auto pr-3">
          <v-item-group v-model="selectedChat" mandatory>
            <v-item
              v-slot="{active, toggle}"
              value="news"
            >
              <v-sheet :color="active ? '#0049bd' : '#c0d4e5'">
                <div
                  style="cursor: pointer;"
                  class="text-no-wrap d-flex flex-row align-center"
                  @click="toggle"
                >
                  <v-icon :color="active ? 'white' : '#0049bd'" class="px-1">
                    mdi-newspaper-variant
                  </v-icon>
                  <span :class="active ? 'white--text' : ''">news</span>
                </div>
              </v-sheet>
            </v-item>
            <v-item
              v-for="c in channels"
              :key="c.id"
              v-slot="{active, toggle}"
              :value="{channel: c.id, to: c.id}"
            >
              <v-sheet :color="active ? '#0049bd' : '#c0d4e5'">
                <div
                  style="cursor: pointer;"
                  class="text-no-wrap d-flex flex-row align-center"
                  @click="toggle"
                >
                  <v-icon :color="active ? 'white' : '#0049bd'" class="px-1">
                    mdi-list-box-outline
                  </v-icon>
                  <span :class="active ? 'white--text' : ''">{{ c.name }}</span>
                  <v-icon v-if="unread[c.id]" small color="red" class="ml-1">
                    mdi-circle
                  </v-icon>
                </div>
              </v-sheet>
            </v-item>
            <div
              v-for="[type, title] in [['td', 'TDs'], ['standard', 'Members'], ['guest', 'Guests']]"
              :key="type"
            >
              <div
                v-if="online(type).length"
                class="text-no-wrap d-flex flex-row align-center overline"
              >
                <span>{{ title }}</span>
                <v-spacer />
                <span class="mx-3">{{ online(type).length }}</span>
              </div>
              <v-item
                v-for="u in online(type)"
                :key="u.value"
                v-slot="{active, toggle}"
                :value="chatFor(u.value)"
              >
                <v-sheet :color="active ? '#0049bd' : '#c0d4e5'" class="pr-3">
                  <div
                    class="text-no-wrap d-flex flex-row align-center mr-3"
                    style="cursor: pointer;"
                    @click="toggle"
                  >
                    <v-icon :color="active ? 'white' : '#0049bd'" class="px-1">
                      {{ statusFor(u.value) }}
                    </v-icon>
                    <span :class="active ? 'white--text' : ''">{{ u.text }}</span>
                    <v-icon v-if="isUnread(u.value)" small color="red" class="ml-1">
                      mdi-circle
                    </v-icon>
                  </div>
                </v-sheet>
              </v-item>
            </div>
          </v-item-group>
        </v-sheet>
        <div class="d-flex flex-row mt-2">
          <v-menu>
            <template #activator="{ on, attrs }">
              <span
                class="caption text-no-wrap text-decoration-underline"
                style="cursor: pointer;"
                v-bind="attrs"
                v-on="on"
              >
                legend
              </span>
            </template>
            <v-card tile class="pa-3">
              <div
                v-for="[i, text, color] in legend"
                :key="i"
                class="d-flex flex-row text-no-wrap align-center mb-3 mr-3"
              >
                <v-icon :color="color || '#0049bd'" class="mr-1">
                  {{ i }}
                </v-icon>
                <span>{{ text }}</span>
              </div>
            </v-card>
          </v-menu>
          <v-spacer />
          <span class="caption text-no-wrap ml-3">
            {{ users.length }} online
          </span>
        </div>
      </v-sheet>
      <!-- MIDDLE  -->
      <v-sheet class="d-flex flex-column flex-grow-1 pa-3">
        <v-sheet class="d-flex flex-row align-center">
          <span class="text-no-wrap"> {{ chatDescription() }} </span>
        </v-sheet>
        <v-divider v-if="selectedChat !== 'news'" class="mb-3 mt-1" />
        <div v-if="selectedChat === 'news'">
          <v-progress-linear v-if="!news || channels.length === 0" indeterminate class="mb-3" />
          <div v-if="news">
            <div v-for="(n, i) in news" :key="i">
              <v-card tile outlined class="mb-3">
                <v-card-title>
                  {{ n.title }}
                  <v-spacer />
                  <v-btn
                    v-if="n.link"
                    small
                    outlined
                    color="#0049bd"
                    @click="openUrl(n.link.url)"
                  >
                    {{ n.link.text }}
                    <v-icon right>
                      mdi-open-in-new
                    </v-icon>
                  </v-btn>
                </v-card-title>
                <div v-if="n.body" class="px-4">
                  <v-divider class="mb-3" />
                  <p>{{ n.body }}</p>
                </div>
              </v-card>
            </div>
          </div>
          <v-btn
            v-if="channels.length"
            small
            outlined
            @click="selectedChat = {channel: channels[0].id, to: channels[0].id}"
          >
            <v-icon left>
              mdi-chevron-left
            </v-icon>
            Go to the lobby
          </v-btn>
        </div>
        <div v-else-if="selectedChat === 'you'">
          <p>
            You are signed in as <span class="blue--text">{{ you.email }}</span>
            <v-btn small outlined class="ml-3" @click="signOut">
              sign out
            </v-btn>
          </p>
          <p>
            You are a <strong>{{ you.type }}</strong> user
          </p>
          <p v-if="you.roles?.includes('admin')" small label>
            You are an admin
          </p>
          <p v-if="you.roles?.includes('td')" small label>
            You are a TD
          </p>
          <v-divider class="my-3" />
          <p>
            If you need help, feel free to ask in the <strong>lobby</strong> or visit our
            <a href="https://help.fortee2.com" target="_blank">help site</a>.
          </p>
        </div>
        <v-sheet v-else-if="selectedChat" id="chat-box" class="d-flex flex-column flex-grow-1 overflow-y-auto">
          <span v-for="(m, index) in messages" :key="index" class="mb-1">
            <strong>{{ m.name }}</strong>
            <v-chip v-if="m.title" small label color="blue-grey lighten-5" class="ml-1 pa-1">
              <strong style="color: #78909C;">{{ m.title }}</strong>
            </v-chip>
            <span class="ml-1 caption grey--text">{{ formatTime(m.t) }}</span>
            <span style="word-break: break-all;">{{ m.text }}</span>
          </span>
        </v-sheet>
        <v-sheet
          v-if="selectedChat && !['you', 'news'].includes(selectedChat)"
          class="d-flex flex-column mt-3"
        >
          <v-form @submit.prevent="() => void 0" @submit="chat">
            <v-text-field
              v-model="message"
              dense
              clearable
              :placeholder="ws ? 'send a message...' : 'offline...'"
              hide-details
              append-icon="mdi-send"
              style="background-color: white; border-radius: 0; border-color: red;"
              :disabled="!selectedChat || !ws"
              @click:append="chat"
            />
          </v-form>
        </v-sheet>
      </v-sheet>
      <!-- RIGHT -->
      <v-sheet color="#8fa5b7" class="d-flex flex-column pa-3" min-width="35%" max-width="35%">
        <v-sheet color="#8fa5b7" class="d-flex flex-grow-1 flex-column overflow-y-auto pr-3">
          <v-card
            v-for="t in today.slice(0, limit)"
            :key="t.id"
            :color="t.later || t.canceled ? 'grey lighten-1' : 'white'"
            flat
            tile
            class="mb-3"
          >
            <v-sheet :color="tournamentColor(t)" class="d-flex flex-row white--text overline px-2 align-center text-no-wrap">
              <div class="text-no-wrap">
                {{ t.startTime }}
              </div>
              <v-divider color="white" vertical class="mx-2" />
              <div class="text-no-wrap">
                <span v-if="t.open">open for {{ ticks[t.id]?.close }}</span>
                <span v-else-if="t.wts">starts in {{ ticks[t.id]?.start }}</span>
                <span v-else-if="t.playing">playing</span>
                <span v-else-if="t.canceled">canceled</span>
                <span v-else-if="t.done">finished</span>
                <span v-else>opens at {{ t.openTime }}</span>
              </div>
              <v-spacer />
              <v-menu v-if="t.playing || t.done" tile offset-y class="pa-3">
                <template #activator="{ on, attrs }">
                  <v-btn icon color="white" v-bind="attrs" v-on="on">
                    <v-icon>
                      mdi-open-in-new
                    </v-icon>
                  </v-btn>
                </template>
                <v-sheet color="#0049bd" class="pa-3">
                  <bracket :t="t" />
                </v-sheet>
              </v-menu>

              <!-- <v-btn
                v-if="t.playing"
                icon
                @click="openUrl(`/track?t=${t.id}`)"
              >
                <v-icon right color="white">
                  mdi-open-in-new
                </v-icon>
              </v-btn>
 -->
              <v-menu offset-x>
                <template #activator="{ on, attrs }">
                  <v-btn icon color="white" v-bind="attrs" v-on="on">
                    <v-icon>
                      mdi-text-box-outline
                    </v-icon>
                  </v-btn>
                </template>
                <human-rules v-model="t.fullRules" />
              </v-menu>
            </v-sheet>
            <div class="px-2 my-2">
              <div>
                <!-- ************************************************************* -->
                <!-- OPEN -->
                <!-- ************************************************************* -->
                <div v-if="t.open" class="d-flex flex-column body-1">
                  <p><strong>{{ t.name }}</strong></p>
                  <p v-if="guest">
                    As a <strong>guest</strong>, you cannot sign up for tournaments
                  </p>
                  <div v-else>
                    <p v-if="t.signedUp">
                      You are <strong>signed up</strong>
                      <span v-if="t.partner">
                        with <strong>{{ nameOf(t.partner) }}</strong>
                      </span>
                      <span v-else-if="t.choosePartner">
                        with <strong>no partner</strong>
                      </span>
                    </p>
                    <p v-else>
                      You are <strong>not signed up</strong>
                    </p>
                    <div v-if="partnerMismatch(t)" class="mb-5">
                      <span>
                        <strong>{{ partnerMismatch(t) }}</strong> signed up with you as partner,
                        do you want to sign up with {{ partnerMismatch(t) }}?
                        <v-btn
                          x-small
                          outlined
                          color="black"
                          :loading="loading"
                          @click="signUp(t, partnerMismatch(t))"
                        >
                          yes
                        </v-btn>
                      </span>
                    </div>
                    <div v-if="t.choosePartner" class="mb-3">
                      <v-select
                        v-model="t.newPartner"
                        dense
                        outlined
                        hide-details
                        label="choose your partner"
                        :items="otherUsers"
                        clearable
                      />
                    </div>
                    <div class="d-flex flex-row mb-1">
                      <v-btn
                        class="green--text"
                        small
                        outlined
                        :loading="loading"
                        :disabled="t.signedUp && t.partner === t.newPartner"
                        @click="signUp(t)"
                      >
                        <v-icon left>
                          mdi-account-check
                        </v-icon>
                        sign up
                      </v-btn>
                      <v-spacer />
                      <v-btn
                        small
                        outlined
                        class="red--text"
                        :loading="loading"
                        :disabled="!t.signedUp"
                        @click="dropOut(t.id)"
                      >
                        <v-icon left>
                          mdi-account-off
                        </v-icon>
                        drop out
                      </v-btn>
                    </div>
                  </div>
                  <p v-if="t.count === 0" class="mt-3 my-0">
                    No one signed up yet
                  </p>
                  <v-expansion-panels v-else flat>
                    <v-expansion-panel>
                      <v-expansion-panel-header class="body-1 px-0 py-0">
                        <span>
                          <strong>{{ t.count }}</strong>
                          signed up
                          <span v-if="t.count < 8">
                            - need <strong>{{ 8 - t.count }}</strong> more
                          </span>
                        </span>
                      </v-expansion-panel-header>
                      <v-expansion-panel-content class="mx-0">
                        <v-sheet max-width="400">
                          <v-chip
                            v-for="s in signupsFor(t).sort()"
                            :key="s"
                            label
                            small
                            class="mr-1 mb-1 white--text"
                            color="#0049bd"
                          >
                            <strong>{{ s }}</strong>
                          </v-chip>
                        </v-sheet>
                      </v-expansion-panel-content>
                    </v-expansion-panel>
                  </v-expansion-panels>
                </div>
                <!-- ************************************************************* -->
                <!-- WAITING TO START -->
                <!-- ************************************************************* -->
                <div v-else-if="t.wts" class="d-flex flex-column body-1">
                  <span><strong>{{ t.name }}</strong></span>
                  <div v-if="!guest">
                    <p v-if="t.signedUp">
                      You <strong>signed up</strong>
                      - wait for your first game to start
                    </p>
                  </div>
                </div>

                <!-- ************************************************************* -->
                <!-- PLAYING -->
                <!-- ************************************************************* -->
                <div v-else-if="t.playing" class="d-flex flex-column body-1">
                  <p><strong>{{ t.name }}</strong></p>
                  <div v-if="!guest && t.isOn">
                    <div v-if="!t.signedUp" />
                    <p v-else-if="!t.inTourney">
                      Unfortunately, <strong>you were dropped</strong>
                      because an odd number of people signed up
                    </p>
                    <p v-else-if="!t.stillPlaying">
                      You were <strong>eliminated</strong>, better luck next time
                    </p>
                    <div v-else-if="t.hasRoom">
                      <p>
                        Your table is ready and your partner is <strong>{{ t.actualPartner }}</strong>
                      </p>
                      <div class="d-flex flex-row">
                        <v-btn
                          small
                          outlined
                          class="green--text"
                          @click="openUrl(t.url)"
                        >
                          <v-icon left>
                            mdi-account-arrow-right
                          </v-icon>
                          go to your table
                        </v-btn>
                        <v-icon class="ml-3" :color="blink ? 'green' : '#00000000'">
                          mdi-arrow-left-circle
                        </v-icon>
                      </div>
                    </div>
                    <p v-else-if="t.stillPlaying">
                      Please wait for your next table to be ready
                    </p>
                  </div>
                  <!-- ROW OF TABLE-STATUS SQUARES -->
                  <div v-if="tablesFor(t).length" class="d-flex flex-column mt-2">
                    <div class="d-flex flex-row align-center">
                      <v-btn
                        v-for="g in tablesFor(t)"
                        :key="g.id"
                        x-small
                        class="mr-1"
                        elevation="0"
                        :color="gameColor(g)"
                        @click="g.room && !g.finished? openUrl(`/play?watch=${g.room.token}`) : undefined"
                      >
                        <div class="caption white--text text-center">
                          <strong>{{ gameStatusLetter(g) }}</strong>
                        </div>
                      </v-btn>
                    </div>
                  </div>
                </div>

                <!-- ************************************************************* -->
                <!-- FINISHED -->
                <!-- ************************************************************* -->
                <div v-else-if="t.done" class="d-flex flex-column body-1">
                  <span><strong>{{ t.name }}</strong></span>
                  <span v-if="t.winners">
                    Congratulations to <strong>{{ t.winners[0] }}</strong> and <strong>{{ t.winners[1] }}</strong>!
                  </span>
                  <span v-else>
                    Unfortunately, something went wrong with the tournament
                  </span>
                </div>

                <!-- ************************************************************* -->
                <!-- LATER -->
                <!-- ************************************************************* -->
                <div v-else class="d-flex flex-column body-1">
                  <span><strong>{{ t.name }}</strong></span>
                </div>
              </div>
            </div>
          </v-card>
          <div v-if="limit < today.length" class="d-flex flex-column align-center">
            <v-btn small icon @click="limit = Infinity">
              Show all
              <v-icon right>
                mdi-chevron-down
              </v-icon>
            </v-btn>
          </div>
        </v-sheet>
      </v-sheet>
    </v-sheet>
  </v-sheet>
</template>
<script>
function format (t) {
  const ms = t - Date.now()
  if (ms > 0) {
    const time = {
      h: Math.floor(ms / 3600000) % 24,
      m: Math.floor(ms / 60000) % 60,
      s: Math.floor(ms / 1000) % 60
    }
    return Object.entries(time)
      .filter(val => val[1] !== 0)
      .map(([key, val]) => `${val}${key}`)
      .join(' ') || '1s'
  }
  return '1s'
}
const dtFormat = new Intl.DateTimeFormat(undefined, {
  timeStyle: 'short'
})
const loaded = Date.now()

export default {
  data () {
    return {
      you: {},
      today: [],
      limit: Infinity,
      users: [],
      table: {},
      /** Either 'news', 'you', undefined, or an object with 'channel' and 'to' */
      selectedChat: 'news',
      /** The list of channels that we get from the server */
      channels: [],
      /** Messages for the currently selected chat */
      messages: [],
      /** The message the user is editing */
      message: undefined,
      /** For a channel or user ID, whether there are unread messages */
      unread: {},
      /** The message history for each channel */
      history: {},
      /** News from <data>/news.json */
      news: undefined,
      // The user status, key is user ID, value is one of
      // 'playing-in-t' | 'playing' | 'invited' | 'signed-up'
      status: {},
      legend: [
        ['mdi-newspaper-variant', 'News about fortee2'],
        ['mdi-list-box-outline', 'This is a chat room'],
        ['mdi-square-small', 'The user is idle'],
        ['mdi-play', 'The user is playing with bots or other players'],
        ['mdi-account', 'The user has been invited to play in a game'],
        ['mdi-alpha-s-box', 'The user has signed up for a tournament'],
        ['mdi-alpha-t-box', 'The user is playing in a tournament'],
        ['mdi-circle-medium', 'You have unread messages', 'red']
      ],
      // For the play dialog
      dialog: false,
      error: undefined,
      partner: undefined,
      left: undefined,
      right: undefined,
      rules: undefined,
      // Other
      loading: false,
      ws: undefined,
      interval: undefined,
      ticks: {},
      blink: false,
      reconnectS: 1,
      refreshDialog: false,
      showDonation: Math.random() < 0.50,
      testing: true,
      tab: undefined,
      help: undefined
    }
  },
  async fetch () {
    try {
      const url = `/api/tournaments/me?v=${encodeURIComponent(this.$config.version)}`
      this.you = await this.$axios.$get(url)
      this.connect()
      this.startPings()
      this.tick()
    } catch (error) {
      if (error?.response?.status === 401) {
        return window.open('/', '_top')
      }
      throw error
    }
  },
  computed: {
    myName () {
      return this.you.displayName || this.you.name
    },
    otherUsers () {
      return this.users.filter(({ value }) => value !== this.you.id)
    },
    guest () {
      return this.you?.type === 'guest'
    }
  },
  watch: {
    selectedChat (value) {
      this.message = undefined
      if (!value || typeof value === 'string') {
        return
      }
      this.messages = []
      this.getChatHistory(value)
    }
  },
  methods: {
    signOut () {
      window.open('/api/signout', '_top')
    },
    startPings () {
      // send a ping message (not a WS ping)
      setInterval(() => {
        if (this.ws) {
          this.ws.send(JSON.stringify({
            ping: `c:${this.$config.version}:${new Date().toISOString()}`
          }))
        }
      }, 3 * 60000)
    },
    connect () {
      const version = encodeURIComponent(this.$config.version)
      let url = `wss://${window.location.hostname}/api/tournaments/tws?v=${version}`
      if (process.env.NUXT_ENV_DEV) {
        url = `ws://${window.location.hostname}:4004/api/tournaments/tws?v=${version}`
      }
      const ws = new WebSocket(url)
      ws.onopen = () => {
        this.reconnectS = 1
        this.ws = ws
        this.ws.onmessage = (event) => {
          const { type, message } = JSON.parse(event.data)
          if (type) {
            this.onMessage(type, message)
          }
        }
        this.ws.send(JSON.stringify({
          type: 'info',
          message: {
            loaded,
            screenW: window.screen.width,
            screenH: window.screen.height,
            innerW: window.innerWidth,
            innerH: window.innerHeight
          }
        }))
      }
      ws.onclose = (event) => {
        this.ws = undefined
        this.history = {}
        if (event.code === 4000) {
          return window.open('/', '_top')
        } else if (event.code === 4001) {
          return
        }
        setTimeout(() => this.connect(), this.reconnectS * 1000)
        this.reconnectS = Math.min(this.reconnectS * 2, 20)
      }
    },
    onMessage (type, message) {
      switch (type) {
        case 'mismatch':
          if (this.ws) {
            this.ws.close(4001)
            this.ws = undefined
          }
          this.refreshDialog = true
          break
        case 'you':
          this.you = message
          break
        case 'online':
          this.checkSelectedChat(message)
          this.users = message
          break
        case 'tournaments':
          this.today = message
          break
        case 'tournament':
          this.updateTournament(message)
          break
        case 'table':
          this.table = message
          break
        case 'user':
          this.updateStatus(message)
          break
        case 'game':
          this.updateGame(message)
          break
        case 'summon':
          this.summon(message)
          break
        case 'channels':
          this.channels = message.channels
          for (const id of message.unread) {
            if (id !== this.selectedChat?.channel) {
              this.unread[id] = true
            }
          }
          break
        case 'news':
          this.news = message
          break
        case 'unread':
          this.unread[message] = true
          break
        case 'chat':
          this.chatReceived(message)
          break
        case 'history':
          this.gotHistory(message)
          break
        case 'users':
          this.status = message
          break
      }
    },
    nameOf (id) {
      const item = this.users.find(({ value }) => value === id)
      return item?.text
    },
    idOf (name) {
      const item = this.users.find(({ text }) => text === name)
      return item?.value
    },
    tableWith () {
      const w = this.table.with
      if (!w) {
        return ''
      } else if (w.length === 0) {
        return 'with bots'
      }
      return w.reduce((result, { name }, index) => {
        if (index === 0) {
          result += name
        } else if (index === w.length - 1) {
          result += ' and ' + name
        } else {
          result += ', ' + name
        }
        return result
      }, 'with ')
    },
    signupsFor (t) {
      return t.signups.map(([s, p]) => `${s}${p ? ' & ' + p : ''}`)
    },
    partnerMismatch (t) {
      if (t.open && t.choosePartner) {
        const name = this.myName
        if (t.signups.some(([s, p]) => s === name && p)) {
          return
        }
        // The first signup with me as a partner
        const theirs = t.signups.find(([s, p]) => p === name)
        if (theirs) {
          // The name of the person that signed up with me
          return theirs[0]
        }
      }
    },
    online (type) {
      return this.users
        .filter(user => user.type === type)
    },
    async signUp (t, partnerName) {
      const { id } = t
      this.loading = true
      let { newPartner } = t
      if (partnerName) {
        newPartner = this.idOf(partnerName)
      }
      const url = `/api/tournaments/signup/${id}/${newPartner || 'null'}`
      const { error } = await this.$axios.$get(url)
      if (error) {
        //
      } else if (Notification?.permission === 'default') {
        Notification.requestPermission()
      }
      this.loading = false
    },
    async dropOut (id) {
      this.loading = true
      const url = `/api/tournaments/dropout/${id}`
      const { error } = await this.$axios.$get(url)
      if (error) {
        //
      }
      this.loading = false
    },
    summon (message) {
      const { name, url } = message
      try {
        if (Notification?.permission === 'granted') {
          const n = new Notification('Your table is ready', {
            tag: url,
            body: `Your table for the "${name}" tournament is ready!`,
            icon: '/favicon.ico'
          })
          if (n.title) {
            // just to get rid of the warning about unused 'n'
          }
        }
      } catch (error) {
        // console.log(error)
      }
    },
    async play () {
      this.loading = true
      try {
        const body = {
          partner: this.partner || null,
          left: this.left || null,
          right: this.right || null,
          rules: this.rules
        }
        const { url, error } = await this.$axios
          .$post('/api/tournaments/start-game', body)
        if (error) {
          this.error = error
          setTimeout(() => {
            this.error = undefined
          }, 5000)
        } else if (url) {
          this.dialog = false
          window.open(url, '_blank')
        }
      } finally {
        this.loading = false
      }
    },
    decline () {
      if (this.table.token) {
        const url = `/api/tournaments/decline/${this.table.token}`
        this.$axios.$get(url)
      }
    },
    updateTournament (tournament) {
      if (!tournament) {
        return
      }
      const i = this.today.findIndex(t => t.id === tournament.id)
      if (i < 0) {
        return
      }
      tournament.newPartner = tournament.partner
      this.today.splice(i, 1, tournament)
    },
    updateStatus (status) {
      const t = this.today.find(({ id }) => id === status.id)
      if (t) {
        this.updateTournament({ ...t, ...status })
      }
    },
    updateGame (game) {
      const t = this.today.find(({ id }) => id === game.tid)
      if (!t) {
        return
      }
      if (!t.games) {
        return
      }
      const round = t.games[game.round - 1]
      if (!round) {
        return
      }
      const index = round.findIndex(other => other.id === game.id)
      if (index >= 0) {
        round.splice(index, 1, game)
      }
    },
    openUrl (url) {
      window.open(url, '_blank')
    },
    marks (game, team) {
      if (game.disq[team]) {
        return -3
      }
      if (game[team] === 'bye') {
        return -2
      }
      const result = game.room?.[team].marks
      if (typeof result === 'number') {
        return result
      }
      return -1
    },
    chipColor (game, team, i) {
      if (game.finished) {
        const other = team === 'us' ? 'them' : 'us'
        if (this.marks(game, team) > this.marks(game, other)) {
          return 'secondary'
        }
      }
      return 'grey lighten-2'
    },
    icon (game, team, i) {
      if (!game.finished && game.room) {
        const status = game.room[team].team[i]
        if (!status.connected) {
          return 'red'
        } else if (game.room.idle && status.outstanding > 0) {
          return 'orange'
        }
        return 'green'
      }
    },
    gameColor (game) {
      if (!game.finished && game.room) {
        const { state, idle } = game.room
        if (state === 'paused') {
          return 'red'
        }
        if (state === 'waiting') {
          return 'orange'
        }
        if (state === 'playing' && idle) {
          return 'orange'
        }
        if (state === 'playing') {
          return 'green'
        }
        if (state === 'over' && idle) {
          return 'red'
        }
      }
      return '#8fa5b7'
    },
    gameStatusLetter (game) {
      if (!game.finished && game.room) {
        const { state, idle } = game.room
        if (state === 'paused') {
          return 'D'
        }
        if (state === 'waiting') {
          return 'W'
        }
        if (state === 'playing' && idle) {
          return 'S'
        }
      }
      if (game.room) {
        return ['us', 'them']
          .map(team => game.disq[team] ? 'F' : game.room[team].marks)
          .join('-')
      }
      return ''
    },
    gamesFor (t) {
      const result = []
      t.games?.forEach(round => round.forEach(game => result.push(game)))
      return result
    },
    // Games that have a room
    tablesFor (t) {
      return this.gamesFor(t).filter(({ room, finished }) => room && !finished)
    },
    tournamentColor (t) {
      if (t.playing) {
        let waiting = false
        let stuck = false
        for (const { room, finished } of this.gamesFor(t)) {
          if (room && !finished) {
            if (room.state === 'waiting' || room.idle) {
              waiting = true
            } else if (room.state === 'paused') {
              stuck = true
            }
          }
        }
        if (stuck) {
          return 'red'
        }
        if (waiting) {
          return 'orange'
        }
        return 'green'
      }
      if (t.open) {
        return 'green'
      }
      if (t.wts) {
        return 'green'
      }
      if (t.later) {
        return 'secondary'
      }
      if (t.canceled) {
        return 'grey darken-1'
      }
      return '#0049bd'
    },
    connected (t, name) {
      return false
    },
    tick () {
      this.blink = !this.blink
      if (!this.interval) {
        this.interval = setInterval(() => this.tick(), 1000)
      }
      this.ticks = this.today.reduce((result, t) => {
        result[t.id] = {
          close: format(t.utcCloseTime),
          start: format(t.utcStartTime)
        }
        return result
      }, {})
    },
    formatTime (t) {
      return dtFormat.format(new Date(t)).toLocaleLowerCase()
    },

    // CHAT --------------------------------------------------------------------

    chatFor (userId) {
      if (userId === this.you.id) {
        return 'you'
      }
      return {
        channel: [this.you.id, userId].sort().join('/'),
        to: userId
      }
    },
    isUnread (userId) {
      const { channel } = this.chatFor(userId)
      if (channel) {
        return this.unread[channel]
      }
    },
    getChatHistory () {
      if (!this.ws || !this.selectedChat) {
        return
      }
      const { channel, to } = this.selectedChat
      const last = this.history[channel]?.at(-1)?.t ?? 0
      this.ws.send(JSON.stringify({
        type: 'history',
        message: {
          to,
          last
        }
      }))
    },
    gotHistory ({ channel, messages }) {
      const history = this.history[channel]
      if (!history) {
        this.history[channel] = messages
      } else {
        const last = history.at(-1)?.t ?? 0
        this.history[channel] = history
          .concat(messages.filter(({ t }) => t > last))
      }
      if (channel === this.selectedChat?.channel) {
        this.unread[channel] = false
        this.messages = this.history[channel]
        this.scrollChat()
      }
    },
    checkSelectedChat (users) {
      const to = this.selectedChat?.to
      if (!to) {
        return
      }
      /**
       * If the selected chat is not a user in the list and not a channel, we
       * change the selection to the first channel. This happens when a user
       * that we're chatting with goes offline
       */
      if (!users.find(({ value }) => value === to)) {
        if (!this.channels.find(({ id }) => id === to)) {
          this.selectedChat = {
            channel: this.channels[0]?.id,
            to: this.channels[0]?.id
          }
        }
      }
    },
    chat () {
      const { message, ws } = this
      const to = this.selectedChat?.to
      if (message && ws && to) {
        ws.send(JSON.stringify({
          type: 'chat',
          message: {
            to,
            text: message
          }
        }))
        this.message = undefined
      }
    },
    chatReceived (message) {
      const { channel } = message
      this.history[channel] = (this.history[channel] ?? []).concat([message])
      if (this.selectedChat?.channel === channel) {
        this.messages = this.history[channel]
        this.scrollChat()
      }
    },
    scrollChat () {
      setTimeout(() => {
        const box = document.getElementById('chat-box')
        if (box) {
          box.scrollTop = box.scrollHeight
        }
      }, 0)
    },
    chatDescription () {
      if (!this.selectedChat) {
        return 'Select a chat room or user on the left'
      }
      if (this.selectedChat === 'news') {
        return ''
      }
      if (this.selectedChat === 'you') {
        return `Hi, ${this.you.name}`
      }
      const channel = this.channels
        .find(({ id }) => id === this.selectedChat?.channel)
      if (channel) {
        return channel.desc
      }
      const to = this.selectedChat.to
      return `Private chat with ${this.nameOf(to)}`
    },
    reload () {
      window.location.replace('/')
    },
    statusFor (userId) {
      switch (this.status[userId]) {
        case 'playing-in-t':
          return 'mdi-alpha-t-box'
        case 'playing':
          return 'mdi-play'
        case 'invited':
          return 'mdi-account'
        case 'signed-up':
          return 'mdi-alpha-s-box'
      }
      return 'mdi-square-small'
    }
    // async screenShot () {
    //   try {
    //     const canvas = document.createElement('canvas')
    //     const context = canvas.getContext('2d')
    //     const video = document.createElement('video')
    //     const captureStream = await navigator.mediaDevices.getDisplayMedia()
    //     video.srcObject = captureStream
    //     context.drawImage(video, 0, 0, window.width, window.height)
    //     const data = canvas.toDataURL('image/png')
    //     captureStream.getTracks().forEach(track => track.stop())
    //     this.$axios.$post('/api/tournaments/ss', { data })
    //   } catch (err) {
    //     console.error('Error ', err)
    //   }
    // }
  }
}
</script>
