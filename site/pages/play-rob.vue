<template>
  <div>
    <v-container fluid>
      <v-row>
        <v-col cols="3">
          <v-container class="pa-0">
            <v-row>
              <v-col class="ma-0 pa-3 pl-3 pr-3 ">
                <v-img contain min-width="300" max-width="400" src="/logo.png" />
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" class="pt-0">
                <v-card flat tile color="#8fa5b7" min-width="300" max-width="400">
                  <v-container class="pa-2">
                    <v-row>
                      <v-col cols="6">
                        <div class="text-center white--text">
                          <h1>
                            US
                          </h1>
                          <span class="subtitle-1">{{ me.name }} & {{ top.name }}</span>
                        </div>
                      </v-col>
                      <v-col cols="6">
                        <div class="text-center white--text">
                          <h1>
                            THEM
                          </h1>
                          <span class="subtitle-1">{{ left.name }} & {{ right.name }}</span>
                        </div>
                      </v-col>
                    </v-row>
                    <v-row>
                      <v-col cols="6">
                        <div class="text-center white--text">
                          <h1 style="font-size: 300%">
                            {{ US.marks }}
                          </h1>
                        </div>
                      </v-col>
                      <v-col cols="6">
                        <div class="text-center white--text">
                          <h1 style="font-size: 300%">
                            {{ THEM.marks }}
                          </h1>
                        </div>
                      </v-col>
                    </v-row>
                  </v-container>
                </v-card>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" class="pa-0 pl-3 pr-3">
                <v-card flat tile color="#c0d4e5" min-width="300" max-width="400">
                  <v-card-text>
                    <div v-if="bidWinner" class="text-center" style="color: #6f6f6f;">
                      <span class="text-h6">{{ bidWinner }} bid <strong>{{ bids[bidWinner] }}</strong></span>
                      <span v-if="trump[bidWinner]" class="text-h6"> on <strong>{{ trump[bidWinner] }}</strong></span>
                    </div>
                  </v-card-text>
                  <v-card-text v-if="bidWinner && trump[bidWinner]">
                    <v-progress-linear
                      :value="bidPercentage"
                      :reverse="teamFor(bidWinner) === 'THEM'"
                      rounded
                      height="25"
                      color="#8dc73f"
                      background-color="#e8e8e8"
                    >
                      <template #default>
                        <!-- {{ US.points }} -->
                      </template>
                    </v-progress-linear>
                  </v-card-text>
                  <v-container>
                    <v-row class="text-center" style="color: #676767;">
                      <v-col cols="6" class="pa-0 pl-1">
                        <h1 v-if="bidWinner && trump[bidWinner]">{{ US.points }}</h1>
                        <v-card flat min-height="350" color="#c0d4e5">
                          <v-card
                            v-for="(trick, index) in pile.US"
                            :key="`US-${index}`"
                            flat
                            color="#c0d4e5"
                          >
                            <v-card-actions>
                              <v-img
                                v-for="bone in trick"
                                :key="bone"
                                class="mr-1"
                                contain
                                max-width="30"
                                :src="`/${bone}v.png`"
                              />
                            </v-card-actions>
                          </v-card>
                        </v-card>
                      </v-col>
                      <v-col cols="6" class="pa-0 pl-1 pr-1">
                        <h1 v-if="bidWinner && trump[bidWinner]">{{ THEM.points }}</h1>
                        <v-card flat min-height="350" color="#c0d4e5">
                          <v-card
                            v-for="(trick, index) in pile.THEM"
                            :key="`THEM-${index}`"
                            color="#c0d4e5"
                            flat
                          >
                            <v-card-actions>
                              <v-img
                                v-for="bone in trick"
                                :key="bone"
                                class="mr-1"
                                contain
                                max-width="30"
                                :src="`/${bone}v.png`"
                              />
                            </v-card-actions>
                          </v-card>
                        </v-card>
                      </v-col>
                    </v-row>
                  </v-container>
                </v-card>
              </v-col>
            </v-row>
          </v-container>
        </v-col>
        <v-col cols="9">
          <!-- THE PLAYING AREA -->
          <v-container>
            <v-row>
              <v-col cols="4" />
              <v-col cols="4">
                <!-- TOP PLAYER STATUS -->
                <StatusNew v-model="top" />
              </v-col>
              <v-col cols="4" />
            </v-row>
            <v-row>
              <v-col cols="4">
                <!-- LEFT PLAYER STATUS -->
                <StatusNew v-model="left" />
              </v-col>
              <v-col cols="4">
                <!-- CENTER AREA -->
              </v-col>
              <v-col cols="4">
                <!-- RIGHT PLAYER STATUS -->
                <StatusNew v-model="right" />
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="4" />
              <v-col cols="4">
                <!-- MY STATUS -->
                <StatusNew v-model="me" :name="false" />
              </v-col>
              <v-col cols="4" />
            </v-row>
            <!-- THE CHOICE BAR -->
            <v-row>
              <v-col cols="12" class="pa-0 mt-6">
                <v-toolbar tile color="#0049bd" class="white--text">
                  <v-spacer />
                  <v-toolbar-title v-if="paused">
                    Waiting for players to join
                  </v-toolbar-title>
                  <v-toolbar-title v-else-if="choiceTitle">
                    {{ choiceTitle }}
                  </v-toolbar-title>
                  <v-toolbar-title v-else-if="waitingForBid">
                    Waiting for {{ waitingForBid }} to bid...
                  </v-toolbar-title>
                  <v-toolbar-title v-else-if="waitingForTrump">
                    Waiting for {{ waitingForTrump }} to call trumps...
                  </v-toolbar-title>
                  <v-toolbar-title v-else-if="waitingForPlay">
                    Waiting for {{ waitingForPlay }} to play...
                  </v-toolbar-title>
                  <div v-if="!paused" class="pl-6">
                    <v-chip
                      v-for="choice in choices"
                      :key="choice"
                      label
                      color="#ff3600"
                      class="mr-1 white--text"
                      @click="choose(choice)"
                    >
                      <strong>{{ choice }}</strong>
                    </v-chip>
                  </div>
                  <v-spacer />
                </v-toolbar>
              </v-col>
            </v-row>
            <!-- MY BONES -->
            <v-row>
              <v-col cols="12" class="pa-0 mt-3">
                <v-card tile color="#8fa5b7">
                  <v-item-group>
                    <v-container>
                      <v-row>
                        <v-col
                          v-for="n in 4"
                          :key="n"
                          cols="3"
                        >
                          <v-item v-slot="{ /* active,*/ toggle }">
                            <v-img
                              :src="`/${bones[n - 1]}.png`"
                              contain
                              max-height="80"
                              @click="toggle"
                            />
                          </v-item>
                        </v-col>
                      </v-row>
                      <v-row>
                        <v-col cols="1" />
                        <v-col
                          v-for="n in 3"
                          :key="n"
                          cols="3"
                        >
                          <v-item v-slot="{ /* active, */ toggle }">
                            <v-img
                              :src="`/${bones[n + 3]}.png`"
                              contain
                              max-height="80"
                              @click="toggle"
                            />
                          </v-item>
                        </v-col>
                      </v-row>
                    </v-container>
                  </v-item-group>
                </v-card>
              </v-col>
            </v-row>
          </v-container>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script>
import StatusNew from '~/components/status-new.vue'
export default {
  components: { StatusNew },
  data () {
    return {
      ws: undefined,
      joining: false,
      youAre: undefined,
      hosting: undefined,
      teams: {
        US: [],
        THEM: []
      },
      pile: {
        US: [],
        THEM: []
      },
      US: {
        marks: 0,
        points: 0
      },
      THEM: {
        marks: 0,
        points: 0
      },
      table: [],
      bots: [],
      connected: [],
      paused: false,
      waitingForBid: undefined,
      bids: {},
      bidWinner: undefined,
      waitingForTrump: undefined,
      trump: {},
      waitingForPlay: undefined,
      plays: {},
      trickWinner: undefined,
      bones: ['null', 'null', 'null', 'null', 'null', 'null', 'null'],

      choiceTitle: undefined,
      choices: [],
      choose: () => undefined
    }
  },
  fetch () {
    this.joining = true
    let url = `wss://${window.location.hostname}/ws`
    if (process.env.NUXT_ENV_DEV) {
      url = `ws://${window.location.hostname}:4004/ws`
    }
    const ws = new WebSocket(url)
    ws.onclose = (event) => {
      this.ws = undefined
    }
    ws.onerror = (event) => {
      console.log('error', event)
    }
    ws.onopen = (event) => {
      this.ws = ws
      console.log('open')
    }
    ws.onmessage = (event) => {
      const { ack, type, message } = JSON.parse(event.data, (key, value) => {
        if (typeof value === 'string') {
          return value.replace(/^#(bid|bone|trump):/, '')
        }
        return value
      })
      this.handleMessage(type, message, ack)
    }
  },
  computed: {
    left () { return this.status(1) },
    top () { return this.status(2) },
    right () { return this.status(3) },
    me () { return this.status(0) },
    bidPercentage () {
      const bid = this.bids[this.bidWinner]
      if (!bid) {
        return 0
      }
      const max = bid.length === 2 ? parseInt(bid, 10) : 42
      const value = this.teamFor(this.bidWinner) === 'US'
        ? this.US.points
        : this.THEM.points
      return Math.min(100, 100 * (value / max))
    }
  },
  watch: {},
  mounted () {},
  methods: {
    send (type, message, ack) {
      if (this.ws) {
        this.ws.send(JSON.stringify({
          type,
          ack,
          message: message || {}
        }))
      }
    },
    async handleMessage (type, message, ack) {
      console.log(ack || '', type, message)
      switch (type) {
        case 'welcome':
          this.youAre = message.youAre
          break

        case 'startingGame':
          break

        case 'youEnteredGameRoom':
        case 'enteredGameRoom':
        case 'leftGameRoom':
          {
            this.hosting = message.hosting
            this.table = []
            this.bots = message.bots
            this.paused = message.paused
            this.teams = { US: [], THEM: [] }
            let index = message.players.indexOf(this.youAre)
            for (let i = 0; i < 4; i++) {
              if (i === 0 || i === 2) {
                this.teams.US.push(message.players[i])
              } else {
                this.teams.THEM.push(message.players[i])
              }
              this.table.push({ name: message.players[index++] })
              if (index === message.players.length) {
                index = 0
              }
            }
            this.connected = message.connected
          }
          break

        case 'startingHand':
          await this.prompt('Ready to start the next hand?', ['Yes'])
          this.bids = {}
          this.trump = {}
          this.bidWinner = undefined
          this.pile = { US: [], THEM: [] }
          this.send('readyToStartHand', null, ack)
          break

        case 'draw':
          this.bones = message.bones
          break

        case 'waitingForBid':
          this.waitingForBid = message.from
          break

        case 'bid':
          this.waitingForBid = this.youAre
          this.prompt('Your bid', message.possible).then((bid) => {
            this.waitingForBid = undefined
            this.bids[this.youAre] = bid
            this.send('submitBid', { bid: `#bid:${bid}` }, ack)
          })
          break

        case 'bidSubmitted':
          this.waitingForBid = undefined
          this.bids[message.from] = message.bid
          break

        case 'reshuffle':
          this.bids = {}
          break

        case 'bidWon':
          this.bids = { [message.from]: message.bid }
          this.bidWinner = message.from
          this.US.points = 0
          this.THEM.points = 0
          break

        case 'waitingForTrump':
          this.waitingForTrump = message.from
          break

        case 'call':
          this.waitingForTrump = this.youAre
          this.prompt('Call trumps', message.possible).then((trump) => {
            this.trump = { [this.youAre]: trump }
            this.send('callTrump', { trump: `#trump:${trump}` }, ack)
          })
          break

        case 'trumpSubmitted':
          this.waitingForTrump = undefined
          this.trump = { [message.from]: message.trump }
          break

        case 'waitingForPlay':
          this.waitingForPlay = message.from
          break

        case 'play':
          this.waitingForPlay = this.youAre
          this.prompt('What will it be?', message.possible).then((bone) => {
            this.plays[this.youAre] = bone
            this.bones[this.bones.indexOf(bone)] = 'null'
            this.send('play', { bone: `#bone:${bone}` }, ack)
          })
          break

        case 'playSubmitted':
          this.waitingForPlay = undefined
          this.plays[message.from] = message.bone
          break

        case 'endOfTrick':
          this.trickWinner = message.winner
          this.US = message.status.US
          this.THEM = message.status.THEM
          await this.prompt(`${message.winner} won the trick with ${message.points} point${message.points === 1 ? '' : 's'}`, ['Next trick'])
          this.plays = {}
          this.trickWinner = undefined
          this.send('readyToContinue', null, ack)
          this.pile.US = message.status.US.pile
          this.pile.THEM = message.status.THEM.pile
          break

        case 'endOfHand':
          {
            const team = message.winner
            const players = this.table
              .filter(({ name }) => this.teamFor(name) === team)
              .map(({ name }) => name)
              .join(' and ')
            const title = `${players} won the hand`
            this.US = message.status.US
            this.THEM = message.status.THEM
            await this.prompt(title, ['Continue'])
            this.send('readyToContinue', null, ack)
            this.US.points = undefined
            this.THEM.points = undefined
          }
          break

        case 'gameOver':
          if (this.hosting) {
            const title = 'The game is over, would you like to play again?'
            const response = await this.prompt(title, ['Play again', 'Close'])
            if (response === 'Close') {
              this.ws.close()
              window.close()
              window.location.replace('https://fortee2.slack.com/')
              return
            }
            this.send('playAgain', null)
          } else {
            await this.prompt('Game over', ['OK'])
          }
          this.US.marks = 0
          this.US.points = undefined
          this.THEM.marks = 0
          this.THEM.points = undefined
          this.bids = {}
          this.trump = {}
          this.bidWinner = undefined
          this.pile = { US: [], THEM: [] }
          break
      }
    },
    bidForTeam (team) {
      if (this.bidWinner && this.teamFor(this.bidWinner) === team) {
        return this.bids[this.bidWinner]
      }
    },
    teamFor (name) {
      if (this.teams.US.includes(name)) {
        return 'US'
      }
      return 'THEM'
    },
    status (index) {
      const name = this.table[index]?.name
      if (!name) {
        return {}
      }
      return {
        name,
        connected: this.connected.includes(name),
        bot: this.bots.includes(name),
        waitingForBid: this.waitingForBid === name,
        bid: this.bids[name],
        waitingForTrump: this.waitingForTrump === name,
        trump: this.trump[name],
        waitingForPlay: this.waitingForPlay === name,
        play: this.plays[name],
        trickWinner: this.trickWinner === name
      }
    },
    prompt (title, choices) {
      this.choiceTitle = title
      this.choices = choices
      return new Promise((resolve) => {
        this.choose = (value) => {
          this.choiceTitle = undefined
          this.choices = []
          resolve(value)
        }
      })
    }
  }
}
</script>
