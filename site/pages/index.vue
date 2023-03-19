<template>
  <v-app dark style="background: black">
    <v-main>
      <v-card
        color="black"
        min-width="375"
      >
        <v-card-text v-if="state.startsWith('join')">
          <v-container>
            <v-row>
              <v-col
                v-for="(image) in images"
                :key="image"
                cols="3"
              >
                <v-img :src="image" aspect="1" />
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>
        <v-card-title
          v-if="state.startsWith('join')"
          style="font-size: 370%"
        >
          <v-spacer />
          i a m l i a m
          <v-spacer />
        </v-card-title>
        <!-- <v-card-text v-if="state.startsWith('join')" /> -->
        <!-- JOIN -->
        <div v-if="state === 'join'">
          <v-card-text>
            <v-text-field
              v-model="name"
              placeholder="What is your name?"
              outlined
              counter="10"
            />
          </v-card-text>
          <v-card-text>
            <v-container fluid class="pa-0">
              <v-row>
                <v-col cols="10">
                  <v-text-field
                    v-model="code"
                    placeholder="What is the secret code?"
                    outlined
                    hide-details
                  />
                </v-col>
                <v-col cols="2" align-self="center">
                  <v-btn
                    icon
                    color="green"
                    :disabled="!goodToJoin"
                    :loading="joining"
                    @click="join"
                  >
                    <v-icon>mdi-arrow-right-bold-circle</v-icon>
                  </v-btn>
                </v-col>
              </v-row>
            </v-container>
          </v-card-text>
          <v-expansion-panels>
            <v-expansion-panel>
              <v-expansion-panel-header color="black">
                Create a game
              </v-expansion-panel-header>
              <v-expansion-panel-content color="black">
                <v-card-text>
                  <v-container fluid class="pa-0">
                    <v-row>
                      <v-col cols="10">
                        <v-text-field
                          v-model="numberOfPlayers"
                          placeholder="Number of players"
                          outlined
                          hide-details
                        />
                      </v-col>
                      <v-col cols="2" align-self="center">
                        <v-btn
                          icon
                          color="green"
                          :disabled="!goodToStart"
                          :loading="joining"
                          @click="create"
                        >
                          <v-icon>mdi-arrow-right-bold-circle</v-icon>
                        </v-btn>
                      </v-col>
                    </v-row>
                  </v-container>
                </v-card-text>
              </v-expansion-panel-content>
            </v-expansion-panel>
          </v-expansion-panels>
        </div>
        <!-- READY -->
        <div v-else-if="state === 'joined'">
          <v-card-text>
            <v-simple-table>
              <template #default>
                <tbody>
                  <tr v-for="player in players" :key="player.name">
                    <td
                      :class="player.ready ? 'green--text' : ''"
                      style="font-size: 120%"
                    >
                      {{ player.name }}
                    </td>
                  </tr>
                </tbody>
              </template>
            </v-simple-table>
          </v-card-text>
          <v-card-actions v-if="ready && !starting">
            <v-spacer />
            <v-btn primary @click="start">
              ready
            </v-btn>
            <v-spacer />
          </v-card-actions>
          <v-card-text v-else-if="!starting" style="text-align: center">
            <p style="font-size: 120%">
              Waiting for players
            </p>
            <p style="text-align: center;font-family: Rubik">
              the secret code is {{ code }}
            </p>
          </v-card-text>
        </div>
        <!-- QUESTION -->
        <div v-else-if="state === 'question'">
          <v-card-text>
            <v-item-group v-model="selected">
              <v-row>
                <v-col
                  v-for="(liam, index) in liams"
                  :key="index"
                  cols="6"
                  md="6"
                >
                  <v-item v-slot="{ active, toggle }">
                    <v-img
                      :src="`${liam.key}.jpg`"
                      aspect="1"
                      class="pa-2"
                      @click="toggleSelected(toggle)"
                    >
                      <v-overlay
                        absolute
                        :color="score && score.correct !== liam.key ? 'black' : 'black'"
                        :opacity="0.8"
                        :value="score ? score.correct !== liam.key : false"
                        z-index="0"
                      />
                      <v-card
                        v-if="active && !score"
                        color="black"
                      >
                        <v-card-actions>
                          <v-spacer />
                          <span style="font-size: 140%">
                            {{ liam.name }}
                          </span>
                          <v-spacer />
                        </v-card-actions>
                      </v-card>
                      <v-card
                        v-if="score"
                        flat
                        color="rgba(0,0,0,0)"
                      >
                        <v-chip
                          v-for="(player) in score.results.filter(item => item.answer === liam.key)"
                          :key="player.name"
                          :color="score && score.correct === liam.key ? 'green' : 'red'"
                          class="mr-1 mb-2 black--text"
                          label
                        >
                          {{ player.name }}
                          <v-avatar
                            right
                            color="black"
                            class="white--text"
                            style="font-family: Rubik"
                            size="100"
                          >
                            {{ player.points }}
                          </v-avatar>
                        </v-chip>
                      </v-card>
                    </v-img>
                  </v-item>
                </v-col>
              </v-row>
            </v-item-group>
          </v-card-text>
        </div>
        <!-- GAME OVER -->
        <div v-else-if="state === 'done'">
          <v-card-text
            style="font-size: 250%; line-height: 1.5; text-align: center;"
          >
            {{ winner.name }} wins with {{ winner.points }} points!
          </v-card-text>
          <v-card-text>
            <v-simple-table style="font-size: 120%">
              <template #default>
                <tbody>
                  <tr v-for="(item) in score.results" :key="item.name">
                    <td style="text-align: left">
                      {{ item.name }}
                    </td>
                    <td style="text-align: right">
                      {{ item.points }}
                    </td>
                  </tr>
                </tbody>
              </template>
            </v-simple-table>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              primary
              @click="$router.go()"
            >
              play again
            </v-btn>
            <v-spacer />
          </v-card-actions>
        </div>
        <!-- COUNTDOWN TIMER -->
        <v-card-actions v-if="state === 'question'">
          <span
            class="ma-2"
            style="font-size: 140%; line-height: 1.3;"
          >
            {{ question }}
          </span>
        </v-card-actions>
        <v-card-actions v-if="state !== 'join'" class="ma-2">
          <v-progress-linear
            v-if="ticking"
            :value="secondsPercent"
            color="black"
            height="36"
            striped
          >
            <span style="font-size: 120%">
              {{ (typeof ticking === 'string') ? ticking : '' }} {{ seconds }}
            </span>
          </v-progress-linear>
          <v-sheet v-else height="36" />
        </v-card-actions>
      </v-card>
      <v-footer v-if="state === 'join'" color="black">
        <v-col cols="12" class="text-center caption grey--text">
          <br><br><br>
          <p style="font-family: Rubik">
            {{ $config.version }}
          </p>
        </v-col>
      </v-footer>
    </v-main>
  </v-app>
</template>
<script>
export default {
  data () {
    return {
      liams: [
        { key: 'ni', name: 'Nite' },
        { key: 'he', name: 'Hemsworth' },
        { key: 'ga', name: 'Gallagher' },
        { key: 'ne', name: 'Neeson' }
      ],
      state: 'join',
      name: undefined,
      code: undefined,
      numberOfPlayers: undefined,
      joining: false,
      ws: undefined,
      ready: false,
      starting: false,
      players: [],
      images: [],
      // For countdowns
      ticking: false,
      secondsPercent: 100,
      seconds: 0,
      // The current question
      question: undefined, // 'This Liam achieved fame as the lead vocalist of the rock band Oasis from 1991 to 2009',
      // The index in 'liams' for the selected one, or undefined
      selected: undefined,
      score: undefined,
      winner: undefined
    }
  },
  fetch () {
  },
  computed: {
    goodName () {
      return this.name && this.name.length <= 10
    },
    goodToJoin () {
      return this.goodName && this.code
    },
    goodToStart () {
      const n = parseInt(this.numberOfPlayers, 10)
      return this.goodName && !isNaN(n) && n > 0 && n <= 10
    }
  },
  watch: {
    selected (value) {
      const answer = value === undefined ? null : this.liams[value].key
      this.send('answer', { answer })
    }
  },
  mounted () {
    for (const liam of this.liams) {
      this.images.push(`${liam.key}.jpg`)
    }
    setInterval(() => {
      if (this.state === 'join' || this.state === 'joined') {
        this.images.push(this.images.shift())
      }
    }, 250)
  },
  methods: {
    async create () {
      this.joining = true
      const url = `/api/start/${this.numberOfPlayers}`
      const game = await this.$axios.$post(url)
      this.code = game.id
      this.join()
    },
    join () {
      this.joining = true
      const port = parseInt(window.location.port || '80', 10)
      const url = `ws://${window.location.hostname}:${port + 1}`
      const ws = new WebSocket(url)
      ws.addEventListener('close', (event) => {
        this.ws = undefined
        if (this.state === 'join') {
          this.joining = false
        } else if (this.state !== 'done') {
          this.$router.go()
        }
      })
      // ws.addEventListener('error', (event) => {
      //   console.log(event)
      // })
      ws.addEventListener('open', (event) => {
        this.ws = ws
        ws.addEventListener('message', (event) => {
          const message = JSON.parse(event.data)
          switch (message.type) {
            // A player has joined
            // If ready is true, all players have joined
            case 'joined':
              this.state = 'joined'
              this.joining = false
              this.starting = false
              this.ready = message.ready
              this.players = message.players
              break
            case 'ready':
              this.players = message.players
              break
            // A countdown to the first question
            case 'starting':
              this.tick(message.ms, 'First question in')
              break
            // We got a question
            case 'question':
              this.questionReceived(message)
              break
            // We got the results of a question
            case 'score':
              this.scoreReceived(message)
              break
            // We have a winner
            case 'done':
              this.gameOver(message)
              break
          }
        })
        this.send('join', {
          id: parseInt(this.code, 10),
          name: this.name
        })
      })
    },
    send (type, message) {
      if (this.ws) {
        this.ws.send(JSON.stringify(Object.assign({ type }, message)))
      }
    },
    start () {
      this.starting = true
      this.send('ready')
    },
    questionReceived (message) {
      this.liams = this.shuffle(this.liams)
      this.question = message.question
      this.selected = undefined
      this.score = undefined
      this.state = 'question'
      this.tick(message.ms)
    },
    scoreReceived (message) {
      // this.state = 'score'
      this.score = message
      this.tick(message.ms, 'Next question in')
    },
    gameOver (message) {
      this.state = 'done'
      this.winner = message.winner
      this.ws.close()
      this.ws = undefined
    },
    toggleSelected (toggle) {
      if (!this.score) {
        toggle()
      }
    },
    shuffle (array) {
      const n = Math.floor(array.length * Math.random())
      const result = [...array]
      const t = result[0]
      result[0] = result[n]
      result[n] = t
      return result
    },
    tick (ms, label) {
      this.secondsPercent = 100
      this.seconds = ms / 1000
      this.ticking = label || true
      return new Promise((resolve) => {
        setTimeout(() => {
          const start = new Date().getTime()
          const then = start + ms
          const interval = setInterval(() => {
            const now = new Date().getTime()
            const percent = ((now - start) / (then - start))
            this.secondsPercent = 100 * (1 - percent)
            this.seconds = Math.max(0, Math.round((ms * (1 - percent)) / 1000))
            if (this.seconds === 0) {
              this.secondsPercent = 0
              this.seconds = 0
              clearInterval(interval)
              this.ticking = false
              resolve()
            }
          }, 50)
        }, 250)
      })
    }
  }
}
</script>
