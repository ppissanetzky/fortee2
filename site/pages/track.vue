<template>
  <div class="ma-3">
    <!-- ************************************************************* -->
    <!-- TOOLBAR -->
    <!-- ************************************************************* -->
    <v-toolbar flat color="#0049bd" max-width="1000">
      <v-img contain max-width="375" src="/logo-tight.png" />
      <span class="caption white--text ml-2 mb-1 align-self-end">
        <strong>{{ $config.version }}</strong>
      </span>
      <v-spacer />
      <v-toolbar-title v-if="you.name" class="white--text">
        <strong>Hi, {{ you.prefs?.displayName || you.name }}</strong>
      </v-toolbar-title>
      <v-menu v-if="you?.roles?.includes('td')" offset-y>
        <template #activator="{ on, attrs }">
          <v-btn icon color="white" v-bind="attrs" v-on="on">
            <v-icon>mdi-chevron-down</v-icon>
          </v-btn>
        </template>
        <v-card tile>
          <v-card-actions>
            <v-btn
              text
              @click="openUrl('/td')"
            >
              open TD page
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-menu>
    </v-toolbar>
    <v-sheet v-if="t" class="d-flex flex-column pt-3">
      <v-row class="align-self-center">
        <v-col cols="12">
          <h2>{{ t.name }}</h2>
          <v-divider class="my-3" />
        </v-col>
      </v-row>
      <v-row class="align-self-center">
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
                  :color="gameColor(game)"
                  class="white--text caption"
                >
                  <span>
                    {{ game.id }}
                  </span>
                  <v-btn
                    v-if="game.room && !game.finished"
                    small
                    text
                    color="white"
                    @click="openUrl(`/play?watch=${game.room.token}`)"
                  >
                    watch
                  </v-btn>
                  <v-spacer />
                  <span v-if="game.finished">finished</span>
                  <div v-else-if="game.room">
                    <span v-if="game.room.state === 'waiting'">waiting for players</span>
                    <span v-else-if="game.room.state === 'playing' && game.room.idle">stuck</span>
                    <span v-else-if="game.room.state === 'playing'">playing</span>
                    <span v-else-if="game.room.state === 'paused'">paused</span>
                    <span v-else>expired</span>
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
                      <div class="ml-5">
                        <h3 v-if="game.disq[team]" class="red--text">
                          F
                        </h3>
                        <h3 v-else-if="game.room">
                          {{ game.room[team].marks }}
                        </h3>
                      </div>
                    </v-toolbar>
                  </div>
                </v-sheet>
              </v-card>
            </div>
          </div>
        </v-col>
      </v-row>
    </v-sheet>
  </div>
</template>
<script>
export default {
  data () {
    return {
      you: {},
      tid: undefined,
      t: undefined,
      ws: undefined
    }
  },
  fetch () {
    this.connect()
  },
  methods: {
    connect () {
      const version = encodeURIComponent(this.$config.version)
      const tid = parseInt(this.$route.query.t, 10)
      if (!tid || isNaN(tid)) {
        return
      }
      this.tid = tid
      let url = `wss://${window.location.hostname}/api/tournaments/track/${tid}?v=${version}`
      if (process.env.NUXT_ENV_DEV) {
        url = `ws://${window.location.hostname}:4004/api/tournaments/track/${tid}?v=${version}`
      }
      const ws = new WebSocket(url)
      ws.onopen = () => {
        this.ws = ws
        this.ws.onmessage = (event) => {
          const { type, message } = JSON.parse(event.data)
          console.log(type, message)
          if (type) {
            this.onMessage(type, message)
          }
        }
      }
      ws.onclose = () => {
        this.ws = undefined
      }
    },
    onMessage (type, message) {
      switch (type) {
        case 'mismatch':
          this.ws.close(4001)
          this.ws = undefined
          break
        case 'you':
          this.you = message
          break
        case 'tournaments':
          this.t = message.find(({ id }) => id === this.tid)
          break
        case 'tournament':
          this.updateTournament(message)
          break
        case 'game':
          this.updateGame(message)
          break
      }
    },
    updateTournament (tournament) {
      if (tournament?.id === this.tid) {
        if (!tournament.playing) {
          this.ws.close(4000)
          this.ws = undefined
          return
        }
        this.t = tournament
      }
    },
    updateGame (game) {
      if (game?.tid === this.tid) {
        const t = this.t
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
      }
      return 'green'
    }
  }
}
</script>
