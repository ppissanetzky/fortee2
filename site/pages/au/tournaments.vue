<template>
  <div class="ma-3">
    <v-card
      color="#0049bd"
      class="mb-3"
      min-width="375"
    >
      <v-toolbar flat color="#0049bd">
        <v-toolbar-title v-if="you.name" class="white--text pl-1">
          <strong>Hi, {{ you.name }}</strong>
        </v-toolbar-title>
        <v-btn
          v-if="you?.roles?.includes('td')"
          outlined
          small
          color="white"
          class="ml-3"
          @click="td"
        >
          TD
        </v-btn>

        <v-spacer />
        <v-btn outlined small color="white" class="mr-3" @click="quickGame()">
          quick game
        </v-btn>
        <v-menu
          v-model="menu"
          :close-on-content-click="false"
        >
          <template #activator="{ on, attrs }">
            <v-btn
              v-bind="attrs"
              outlined
              small
              color="white"
              class="mr-9"
              v-on="on"
            >
              custom game
            </v-btn>
          </template>
          <custom-game :users="users" />
        </v-menu>
        <v-img contain max-width="300" src="/logo.png" />
      </v-toolbar>
    </v-card>
    <v-card
      v-if="invitation"
      outlined
      class="mb-3"
      min-width="375"
      style="border-color: #ff3600; border-width: 2px;"
    >
      <v-card-title>
        <v-icon color="black" class="pr-2">
          mdi-play-circle
        </v-icon>
        {{ invitation.text }}
        <v-spacer />
        <v-btn
          outlined
          small
          @click="openInvitation"
        >
          play
        </v-btn>
      </v-card-title>
    </v-card>
    <div>
      <v-card
        v-for="t in today"
        :key="t.id"
        min-width="375"
        color="#c0d4e5"
        class="mb-3"
      >
        <!-- NAME AND START TIME -->
        <v-toolbar flat color="#00000000">
          <v-icon color="black" class="pr-2">
            mdi-trophy
          </v-icon>
          <h2>{{ t.name }}</h2>
          <v-spacer />
          <h2>{{ t.startTime }}</h2>
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
            :items="users"
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
            Your partner is <strong>{{ partner(t) }}</strong>
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
            @click="goToTable(t.url)"
          >
            go to your table
          </v-btn>
        </v-toolbar>
        <v-sheet v-if="t.open || (t.isOn && t.signedUp)" height="12" />
      </v-card>
    </div>
  </div>
</template>
<script>
export default {
  data () {
    return {
      you: {},
      today: [],
      users: [],
      loading: false,
      ws: undefined,
      menu: false,
      invitation: undefined,
      interval: undefined,
      ticks: {},
      reconnectS: 1
    }
  },
  async fetch () {
    try {
      const {
        users,
        tournaments,
        you,
        invitation
      } = await this.$axios.$get('/api/tournaments')
      this.users = Object.keys(users).map(key => ({ value: key, text: users[key] }))
      for (const t of tournaments) {
        t.newPartner = t.partner
      }
      this.today = tournaments
      this.you = you
      this.invitation = invitation

      this.tick()
      this.connect()
      // this.startPings()
    } catch (error) {
      if (error?.response?.status === 401) {
        const url = `/slack/redirect?to=${encodeURIComponent(window.location)}`
        return window.open(url, '_top')
      }
      throw error
    }
  },
  methods: {
    startPings () {
      setInterval(() => {
        if (this.ws) {
          this.ws.send(JSON.stringify({
            ping: new Date().toISOString()
          }))
        }
      }, 60000)
    },
    connect () {
      let url = `wss://${window.location.hostname}/api/tournaments/tws`
      if (process.env.NUXT_ENV_DEV) {
        url = `ws://${window.location.hostname}:4004/api/tournaments/tws`
      }
      console.log('connecting...')
      const ws = new WebSocket(url)
      ws.onopen = () => {
        console.log('connected')
        this.reconnectS = 1
        this.ws = ws
        this.ws.onmessage = (event) => {
          console.log('message', event)
          const { type, message } = JSON.parse(event.data)
          if (type) {
            this.onMessage(type, message)
          }
        }
      }
      // ws.onerror = (event) => {
      //   console.log('ws error', event)
      //   ws.close()
      // }
      ws.onclose = (event) => {
        console.log('ws close', event)
        this.ws = undefined
        setTimeout(() => this.connect(), this.reconnectS * 1000)
        this.reconnectS *= 2
      }
    },
    onMessage (type, message) {
      switch (type) {
        case 'online':
          break
        case 'tournament':
          this.updateTournament(message)
          break
        case 'drop':
          this.dropTournament(message)
          break
        case 'invitation':
          this.invitation = message
          break
        case 'dropInvitation':
          this.invitation = undefined
          break
        case 'tomorrow':
          history.go()
          break
      }
    },
    nameOf (id) {
      const item = this.users.find(({ value }) => value === id)
      return item?.text
    },
    async signUp (t) {
      const { id, newPartner } = t
      this.loading = true
      const url = `/api/tournaments/signup/${id}/${newPartner || 'null'}`
      const { error, tournament } = await this.$axios.$get(url)
      if (error) {
        //
      } else {
        this.updateTournament(tournament)
      }
      this.loading = false
    },
    async dropOut (id) {
      this.loading = true
      const url = `/api/tournaments/dropout/${id}`
      const { error, tournament } = await this.$axios.$get(url)
      if (error) {
        //
      } else {
        this.updateTournament(tournament)
      }
      this.loading = false
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
    dropTournament (id) {
      const i = this.today.findIndex(t => t.id === id)
      if (i < 0) {
        return
      }
      this.today.splice(i, 1)
    },
    goToTable (url) {
      window.open(url, '_blank')
    },
    partner (t) {
      const { positions } = t
      if (positions && this.you) {
        const i = positions.indexOf(this.you)
        return positions[[2, 3, 0, 1][i]]
      }
    },
    others (t) {
      const { positions } = t
      if (positions) {
        const us = [this.you, this.partner(t)]
        return positions.filter(name => !us.includes(name))
      }
      return []
    },
    connected (t, name) {
      return false
    },
    async quickGame () {
      const { url /* , error */ } = await this.$axios
        .$post('/api/tournaments/start-game', { rules: 'default' })
      if (url) {
        window.open(url, '_blank')
      }
    },
    openInvitation () {
      if (this.invitation) {
        window.open(this.invitation.url, '_blank')
      }
    },
    td () {
      window.open('/au/td', '_blank')
    },
    tick () {
      if (!this.interval) {
        this.interval = setInterval(() => this.tick(), 1000)
      }
      const now = Date.now()
      const format = (t) => {
        const ms = t - now
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
      this.ticks = this.today.reduce((result, t) => {
        result[t.id] = {
          close: format(t.utcCloseTime),
          start: format(t.utcStartTime)
        }
        return result
      }, {})
    }
  }
}
</script>
