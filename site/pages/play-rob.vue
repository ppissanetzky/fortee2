<template>
  <div>
    <v-app-bar
      flat
      color="#00256a"
      class="ma-0"
    >
      <div>
        <v-img max-width="253" src="/logo.png" />
      </div>
      <v-spacer />
      <v-icon color="white">mdi-dots-vertical</v-icon>
    </v-app-bar>

    <v-container fluid>
      <v-row>
        <v-col cols="3">
          <v-container class="pa-0">
            <v-row>
              <v-col cols="12">
                <v-card flat color="#818181" rounded="0" min-width="300" max-width="400">
                  <v-container class="pa-2">
                    <v-row>
                      <v-col cols="6">
                        <div class="text-center white--text">
                          <h1>
                            US
                          </h1>
                          <span class="subtitle-1">{{ me.name }} & {{ top.name }}</span>
                          <h1 style="font-size: 300%">
                            {{ US.marks }}
                          </h1>
                        </div>
                      </v-col>
                      <v-col cols="6">
                        <div class="text-center white--text">
                          <h1>
                            THEM
                          </h1>
                          <span class="subtitle-1">{{ left.name }} & {{ right.name }}</span>
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
                <v-card flat color="#dedede" rounded="0" min-width="300" max-width="400">
                  <v-card-text>
                    <div class="text-center" style="color: #6f6f6f;">
                      <h2>{{ bidWinner }} bid {{ bids[bidWinner] }} on {{ trump[bidWinner] }}</h2>
                    </div>
                  </v-card-text>
                  <v-card-text>
                    <v-progress-linear
                      value="24"
                      rounded
                      height="25"
                      color="#8dc73f"
                      background-color="#e8e8e8"
                    />
                  </v-card-text>
                  <v-container>
                    <v-row class="text-center" style="color: #676767;">
                      <v-col cols="6" class="pa-0 pl-1">
                        <h1>{{ US.points }}</h1>
                        <v-card flat min-height="500">

                        </v-card>
                      </v-col>
                      <v-col cols="6" class="pa-0 pl-1 pr-1">
                        <h1>{{ THEM.points }}</h1>
                        <v-card flat min-height="500">
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
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script>
// import Status from '~/components/status.vue'
export default {
  //  components: { Status },
  data () {
    return {
      ws: undefined,
      joining: false,
      youAre: 'Rob',
      hosting: true,
      US: {
        marks: 4,
        points: 24
      },
      THEM: {
        marks: 2,
        points: 1
      },
      table: [{ name: 'Rob' }, { name: 'Jeff' }, { name: 'Pablo' }, { name: 'Scott' }],
      connected: [],
      paused: false,
      waitingForBid: undefined,
      bids: { Rob: '32' },
      bidWinner: 'Rob',
      waitingForTrump: undefined,
      trump: { Rob: 'sixes' },
      waitingForPlay: undefined,
      plays: {},
      trickWinner: undefined,
      bones: ['null', 'null', 'null', 'null', 'null', 'null', 'null'],
      pile: [],

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
    me () { return this.status(0) }
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
          // this.send('joinGame', { token: this.$route.query.t })
          break

        case 'badRoom':
          window.location.replace('/200.html')
          break

        case 'youEnteredGameRoom':
        case 'enteredGameRoom':
        case 'leftGameRoom':
          {
            this.hosting = message.hosting
            this.table = []
            this.paused = message.paused
            let index = message.players.indexOf(this.youAre)
            for (let i = 0; i < 4; i++) {
              this.table.push({ name: message.players[index++] })
              if (index === message.players.length) {
                index = 0
              }
            }
            this.connected = message.connected
          }
          break

        case 'startingGame':
          break

        case 'startingHand':
          await this.prompt('Ready to start the next hand?', ['Yes'])
          this.bids = {}
          this.trump = {}
          this.bidWinner = undefined
          this.pile = []
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
          this.pile = message.status.US.pile
          break

        case 'endOfHand':
          {
            const title = `${message.winner} won the hand`
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
          this.pile = []
          break
      }
    },
    bidForTeam (team) {
      if (this.bidWinner && this.teamFor(this.bidWinner) === team) {
        return this.bids[this.bidWinner]
      }
    },
    teamFor (name) {
      if (name === this.me.name || name === this.top.name) {
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
