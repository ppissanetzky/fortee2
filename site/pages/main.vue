<template>
  <div class="ma-3">
    <v-card
      color="#0049bd"
      tile
      flat
      class="mb-3"
      min-width="375"
    >
      <v-toolbar flat color="#0049bd">
        <v-toolbar-title v-if="you.name" class="white--text">
          <strong>Hi, {{ you.name }}</strong>
        </v-toolbar-title>
        <v-btn
          v-if="you?.roles?.includes('td')"
          outlined
          small
          color="white"
          class="ml-3"
          @click="openUrl('/td')"
        >
          TD
        </v-btn>

        <v-spacer />
        <v-img contain max-width="300" src="/logo.png" />
      </v-toolbar>
    </v-card>
    <div>
      <v-card flat tile class="mb-3">
        <div v-if="!table.status">
          <v-card-title class="ml-0">
            Play with bots or invite others to play
            <v-spacer />
            <v-btn
              outlined
              color="#0049bd"
              @click="dialog = true"
            >
              start a game
            </v-btn>
          </v-card-title>
        </div>
        <div v-else-if="table.status === 't'">
          <v-card-title class="ml-0">
            Your tournament table is ready
            <v-spacer />
            <v-btn
              outlined
              color="#0049bd"
              @click="openUrl(table.url)"
            >
              play
            </v-btn>
          </v-card-title>
        </div>
        <div v-else-if="table.status === 'hosting'">
          <v-card-title class="ml-0">
            You started a game {{ tableWith() }}
            <v-spacer />
            <v-btn
              outlined
              color="red"
              @click="decline"
            >
              close
            </v-btn>
          </v-card-title>
        </div>
        <div v-else-if="table.status === 'invited'">
          <v-card-title class="ml-0">
            You've been invited to play {{ tableWith() }}
            <v-spacer />
            <v-btn
              outlined
              color="#0049bd"
              class="mr-2"
              @click="openUrl(table.url)"
            >
              play
            </v-btn>
            <v-btn
              outlined
              color="red"
              @click="decline"
            >
              decline
            </v-btn>
          </v-card-title>
        </div>
      </v-card>

      <v-card tile flat class="mb-3" color="grey lighten-3">
        <v-card-title>
          Lobby
          <v-spacer />
          <span v-if="users.length" class="caption">{{ users.length }} online</span>
          <span v-else class="caption">No one else online</span>
        </v-card-title>
        <div v-if="users.length" class="mx-3">
          <v-chip
            v-for="name in users.map(({text}) => text).sort()"
            :key="name"
            label
            class="mr-1 mb-1"
          >
            {{ name }}
          </v-chip>
        </div>
        <v-divider class="my-3" />
        <div class="mx-3 mb-3 pb-3">
          <v-card
            id="chat-box"
            height="216"
            flat
            tile
            class="overflow-y-auto pt-1"
          >
            <div v-for="m in messages" :key="m.id" class="mb-1 mx-3">
              <div>
                <strong>{{ m.name }}</strong>
                <v-chip v-if="m.title" small label color="blue-grey lighten-5" class="ml-1">
                  <strong style="color: #78909C;">{{ m.title }}</strong>
                </v-chip>
                <span class="ml-1 caption grey--text">{{ formatTime(m.t) }}</span>
              </div>
              <div>{{ m.text }}</div>
            </div>
          </v-card>
          <v-form @submit.prevent="() => void 0" @submit="chat">
            <v-text-field
              v-model="message"
              color="#0049bd"
              dense
              solo
              clearable
              placeholder="Send a message..."
              hide-details
              append-icon="mdi-send"
              class="mt-3"
              @click:append="chat"
            />
          </v-form>
        </div>
      </v-card>

      <v-card
        v-for="t in today"
        :key="t.id"
        tile
        flat
        outlined
        min-width="375"
        color="#c0d4e5"
        class="mb-3"
      >
        <!-- NAME AND START TIME -->
        <v-toolbar flat color="#00000000">
          <v-icon color="black" class="pr-2">
            mdi-trophy
          </v-icon>
          <h3>{{ t.name }}</h3>
          <v-spacer />
          <h3>{{ t.startTime }}</h3>
        </v-toolbar>

        <!-- RULES AND INDICATOR -->
        <v-toolbar flat color="#c0d4e5">
          <v-chip v-for="r in t.rules" :key="r" label class="mr-1">
            {{ r }}
          </v-chip>
          <v-spacer />
          <v-chip v-if="t.open" label color="red" class="white--text">
            closes in {{ ticks[t.id]?.close }}
          </v-chip>
          <v-chip v-else-if="t.wts" label color="green" class="white--text">
            starts in {{ ticks[t.id]?.start }}
          </v-chip>
          <v-chip v-else-if="t.playing" label color="green" class="white--text">
            playing now
          </v-chip>
          <v-chip v-else-if="t.later" label>
            opens at {{ t.openTime }}
          </v-chip>
          <v-chip v-else-if="t.canceled" label>
            canceled
          </v-chip>
          <span v-else-if="t.winners">
            Won by <strong>{{ t.winners[0] }}</strong> and <strong>{{ t.winners[1] }}</strong>
          </span>
        </v-toolbar>
        <!-- <v-divider /> -->

        <!-- SIGNUP ACTIONS         -->
        <v-toolbar v-if="t.open || t.wts" flat>
          <span v-if="t.signedUp">
            You are <strong>signed up</strong>
            <span v-if="t.partner">
              with <strong>{{ nameOf(t.partner) }}</strong>
            </span>
            <span v-if="t.wts">
              - please wait until <strong>{{ t.startTime }}</strong> ({{ ticks[t.id]?.start }})
            </span>
          </span>
          <span v-else-if="t.open">
            You are <strong>not signed up</strong>, you have {{ ticks[t.id]?.close }}
          </span>
          <span v-else>
            You did not sign up
          </span>
          <v-spacer />
        </v-toolbar>
        <v-toolbar v-if="t.open" flat>
          <!-- TO SIGN UP -->
          <v-select
            v-if="t.choosePartner"
            v-model="t.newPartner"
            dense
            hide-details
            outlined
            label="PARTNER"
            class="mr-2"
            :items="otherUsers"
            clearable
          />
          <v-btn
            outlined
            color="green"
            class="mr-2"
            height="40"
            :loading="loading"
            :disabled="t.signedUp && t.partner === t.newPartner"
            @click="signUp(t)"
          >
            sign up
          </v-btn>
          <v-btn
            outlined
            color="red"
            height="40"
            class="mr-2"
            :loading="loading"
            :disabled="!t.signedUp"
            @click="dropOut(t.id)"
          >
            drop out
          </v-btn>
          <v-spacer />
          <v-spacer />
          <span>
            {{ t.count || 'No one' }} signed up
          </span>
        </v-toolbar>
        <!-- THE LIST OF PEOPLE SIGNED UP WHILE IT'S OPEN OR WTS -->
        <v-card v-if="(t.open || t.wts) && t.signups.length > 0" flat>
          <v-card-text class="pb-0">
            <v-chip
              v-for="s in signupsFor(t)"
              :key="s"
              label
              class="mr-1 mb-1 white--text"
              color="green"
            >
              {{ s }}
            </v-chip>
          </v-card-text>
        </v-card>
        <!-- ONCE THE TOURNAMENT IS PLAYING -->
        <v-toolbar v-if="t.isOn && t.signedUp" flat>
          <span v-if="!t.inTourney">
            Unfortunately, you were dropped from the tournament
          </span>
          <span v-if="!t.stillPlaying">
            Better luck next time...
          </span>
          <span v-else-if="!t.hasRoom && t.hasBye">
            You drew a <strong>bye</strong>, please wait for your first game
          </span>
          <span v-else-if="t.hasRoom">
            Your partner is <strong>{{ partnerIn(t) }}</strong>
            and you're playing against
            <strong>{{ others(t)[0] }}</strong> and
            <strong>{{ others(t)[1] }}</strong>
          </span>
        </v-toolbar>
        <v-toolbar v-if="t.url" flat>
          <v-btn
            outlined
            color="green"
            class="mr-2"
            height="40"
            @click="openUrl(t.url)"
          >
            go to your table
          </v-btn>
        </v-toolbar>
        <v-card v-if="(t.playing || t.done) && t.games" flat tile class="mt-3 pb-1">
          <v-row>
            <v-col v-for="(round, n) in t.games" :key="n" cols="auto">
              <div>
                <h5 class="text-center">
                  ROUND {{ n + 1 }}
                </h5>
              </div>
              <div class="d-flex fill-height flex-column justify-space-around">
                <div v-for="game in round" :key="game.id">
                  <v-card
                    flat
                    tile
                    class="ml-3 my-1"
                    outlined
                    color="#8fa5b7"
                  >
                    <v-toolbar
                      flat
                      height="28"
                      :color="game.started && ! game.finished ? 'green' : '#8fa5b7'"
                      class="white--text caption"
                    >
                      <span>
                        {{ game.id }}
                      </span>
                      <v-spacer />
                      <span v-if="game.finished">finished</span>
                      <div v-else-if="game.room">
                        <span v-if="game.room.state === 'waiting'">waiting for players</span>
                        <span v-if="game.room.state === 'playing'">playing</span>
                        <span v-if="game.room.state === 'paused'">paused</span>
                      </div>
                      <span v-else>waiting</span>
                    </v-toolbar>
                    <v-sheet class="py-2">
                      <v-chip v-if="!game.us && !game.them" label class="mx-4" color="#00000000">
                        Waiting for winners
                      </v-chip>
                      <div v-else>
                        <v-toolbar
                          v-for="team in ['us', 'them']"
                          :key="team"
                          flat
                          height="40"
                        >
                          <v-chip v-if="!game[team]" label color="grey lighten-4">
                            waiting for winners
                          </v-chip>
                          <v-chip v-else-if="game[team] === 'bye'" label color="grey lighten-2">
                            bye
                          </v-chip>
                          <div v-else>
                            <v-chip
                              v-for="i in [0, 1]"
                              :key="i"
                              label
                              :color="chipColor(game, team, i)"
                              class="mr-1"
                            >
                              {{ game[team][i] }}
                              <v-icon v-if="icon(game, team, i)" right small :color="icon(game, team, i)">
                                mdi-circle
                              </v-icon>
                            </v-chip>
                          </div>
                          <v-spacer />
                          <h3 v-if="game.room" class="ml-5">
                            {{ game.room[team].marks }}
                          </h3>
                        </v-toolbar>
                      </div>
                    </v-sheet>
                  </v-card>
                </div>
              </div>
            </v-col>
          </v-row>
        </v-card>
        <!-- JUST A SPACER -->
        <v-sheet v-if="t.open || t.wts || t.playing || t.done" height="12" class="pt-6" />
      </v-card>
    </div>
    <!-- THE DIALOG TO START A GAME -->
    <v-dialog v-model="dialog">
      <v-card>
        <v-toolbar flat color="#8fa5b7">
          <v-toolbar-title class="white--text pl-1">
            <strong>Start a game</strong>
          </v-toolbar-title>
          <v-spacer />
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
  </div>
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
      .join(' ')
  }
}
const dtFormat = new Intl.DateTimeFormat(undefined, {
  timeStyle: 'short'
})
export default {
  data () {
    return {
      you: {},
      today: [],
      users: [],
      table: {},
      messages: [],
      message: undefined,
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
      reconnectS: 1
    }
  },
  async fetch () {
    try {
      this.you = await this.$axios.$get('/api/tournaments/me')
      this.connect()
      this.startPings()
      this.tick()
    } catch (error) {
      if (error?.response?.status === 401) {
        const url = `/slack/redirect?to=${encodeURIComponent(window.location)}`
        return window.open(url, '_top')
      }
      throw error
    }
  },
  computed: {
    otherUsers () {
      return this.users.filter(({ value }) => value !== this.you.id)
    }
  },
  methods: {
    startPings () {
      // send a ping message (not a WS ping)
      setInterval(() => {
        if (this.ws) {
          this.ws.send(JSON.stringify({
            ping: `c:${new Date().toISOString()}`
          }))
        }
      }, 3 * 60000)
    },
    connect () {
      let url = `wss://${window.location.hostname}/api/tournaments/tws`
      if (process.env.NUXT_ENV_DEV) {
        url = `ws://${window.location.hostname}:4004/api/tournaments/tws`
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
      }
      ws.onclose = (event) => {
        this.ws = undefined
        setTimeout(() => this.connect(), this.reconnectS * 1000)
        this.reconnectS = Math.min(this.reconnectS * 2, 20)
      }
    },
    onMessage (type, message) {
      switch (type) {
        case 'online':
          this.users = Object.keys(message)
            .map(key => ({ value: key, text: message[key] }))
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
        case 'chat':
          this.messages.push(message)
          this.scrollChat()
          break
        case 'chatHistory':
          this.messages = message
          this.scrollChat()
          break
      }
    },
    nameOf (id) {
      const item = this.users.find(({ value }) => value === id)
      return item?.text
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
      return t.signups.map(([s, p]) => `${s}${p ? '/' + p : ''}`)
    },
    async signUp (t) {
      const { id, newPartner } = t
      this.loading = true
      const url = `/api/tournaments/signup/${id}/${newPartner || 'null'}`
      const { error } = await this.$axios.$get(url)
      if (error) {
        //
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
    partnerIn (t) {
      const { positions } = t
      if (positions && this.you.name) {
        const i = positions.indexOf(this.you.name)
        return positions[[2, 3, 0, 1][i]]
      }
    },
    others (t) {
      const { positions } = t
      if (positions && this.you.name) {
        const us = [this.you.name, this.partnerIn(t)]
        return positions.filter(name => !us.includes(name))
      }
      return []
    },
    chipColor (game, team, i) {
      if (game.room) {
        if (game.finished) {
          const other = team === 'us' ? 'them' : 'us'
          if (game.room[team].marks > game.room[other].marks) {
            return 'secondary'
          }
        }
      } else if (game.finished) {
        return 'secondary'
      }
      return 'grey lighten-2'
    },
    icon (game, team, i) {
      if (!game.finished && game.room) {
        return game.room[team].team[i].connected ? 'green' : 'red'
      }
    },
    connected (t, name) {
      return false
    },
    tick () {
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
    chat () {
      const { message, ws } = this
      if (message && ws) {
        ws.send(JSON.stringify({ type: 'chat', message }))
        this.message = undefined
      }
    },
    scrollChat () {
      setTimeout(() => {
        const box = document.getElementById('chat-box')
        box.scrollTop = box.scrollHeight
      }, 0)
    }
  }
}
</script>
