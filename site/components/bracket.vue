<template>
  <div>
    <v-sheet v-if="t" class="d-flex flex-column">
      <v-sheet color="#0049bd" class="d-flex flex-row white--text align-center pb-3">
        <h3>
          {{ t.name }}
        </h3>
        <v-spacer />
        <h3>
          {{ time }}
        </h3>
      </v-sheet>
      <v-sheet color="#c0d4e5" class="d-flex flex-row align-self-center py-3 pr-3">
        <v-sheet v-for="(round, n) in t.games" :key="n" color="#00000000" class="d-flex flex-column">
          <div class="mb-2 text-center">
            <span class="overline">
              ROUND {{ n + 1 }}
            </span>
          </div>
          <div class="d-flex fill-height flex-column justify-space-around">
            <div v-for="game in round" :key="game.id">
              <v-card
                flat
                tile
                class="ml-3 mb-3"
                color="#8fa5b7"
              >
                <v-sheet
                  :color="gameColor(game)"
                  class="d-flex flex-row white--text overline align-center"
                >
                  <span class="ml-3">
                    {{ game.id }}
                  </span>
                  <v-divider color="white" vertical class="mx-3" />
                  <span v-if="game.finished">finished</span>
                  <div v-else-if="game.room">
                    <span v-if="game.room.state === 'waiting'">waiting for players</span>
                    <span v-else-if="game.room.state === 'playing' && game.room.idle">stuck</span>
                    <span v-else-if="game.room.state === 'playing'">playing</span>
                    <span v-else-if="game.room.state === 'paused'">paused</span>
                    <span v-else>expired</span>
                  </div>
                  <span v-else>waiting</span>
                  <v-spacer />
                  <v-btn
                    v-if="game.room && !game.finished"
                    x-small
                    outlined
                    color="white"
                    class="mr-3"
                    @click="openUrl(`/play?watch=${game.room.token}`)"
                  >
                    watch
                  </v-btn>
                </v-sheet>
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
                      <div v-else class="text-no-wrap">
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
        </v-sheet>
      </v-sheet>
    </v-sheet>
  </div>
</template>
<script>
function format (t) {
  const ms = Date.now() - t
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
export default {
  props: {
    t: {
      type: Object,
      default: null
    }
  },
  data () {
    return {
      time: ''
    }
  },
  mounted () {
    setInterval(() => {
      if (this.t && !this.t.done) {
        this.time = format(this.t.utcStartTime)
      }
    }, 1000)
  },
  methods: {
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
