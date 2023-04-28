<template>
  <div>
    <div class="d-flex">
      <!-- LEFT SIDE COLUMN -->
      <v-sheet class="d-flex flex-column align-stretch pl-3 pr-2 pb-6" width="300">
        <v-img class="d-flex" max-height="56" aspect-ratio="1" contain src="/logo.png" />
        <v-card class="d-flex mt-1" flat tile color="#8fa5b7">
          <v-container class="pa-2">
            <v-row>
              <v-col cols="6" class="pa-2">
                <div class="text-center white--text">
                  <h2>US</h2>
                  <span class="subtitle-1 pl-1">{{ teams.US[0] }} <br> {{ teams.US[1] }}</span>
                </div>
              </v-col>
              <v-col cols="6" class="pa-2">
                <div class="text-center white--text">
                  <h2>THEM</h2>
                  <span class="subtitle-1 pr-1">{{ teams.THEM[0] }} <br> {{ teams.THEM[1] }}</span>
                </div>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="6" class="pa-0 pb-2">
                <div class="text-center white--text">
                  <h1>
                    {{ US.marks }}
                  </h1>
                </div>
              </v-col>
              <v-col cols="6" class="pa-0 pb-2">
                <div class="text-center white--text">
                  <h1>
                    {{ THEM.marks }}
                  </h1>
                </div>
              </v-col>
            </v-row>
          </v-container>
        </v-card>
        <v-sheet class="d-flex fill-height flex-column mt-2" color="#c0d4e5">
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
                <h1 v-if="bidWinner && trump[bidWinner]">
                  {{ US.points }}
                </h1>
                <v-card flat color="#c0d4e5">
                  <v-card
                    v-for="(trick, index) in pile.US"
                    :key="`US-${index}`"
                    flat
                    color="#c0d4e5"
                    class="d-flex justify-space-around align-center pa-0"
                  >
                    <v-img
                      v-for="bone in trick"
                      :key="bone"
                      class="ma-0 mt-1"
                      contain
                      max-width="29"
                      :src="`/${bone}v.png`"
                    />
                  </v-card>
                </v-card>
              </v-col>
              <v-col cols="6" class="pa-0 pl-1 pr-1">
                <h1 v-if="bidWinner && trump[bidWinner]">
                  {{ THEM.points }}
                </h1>
                <v-card flat color="#c0d4e5">
                  <v-card
                    v-for="(trick, index) in pile.THEM"
                    :key="`THEM-${index}`"
                    color="#c0d4e5"
                    flat
                    class="d-flex justify-space-around align-center pa-0"
                  >
                    <v-img
                      v-for="bone in trick"
                      :key="bone"
                      class="ma-0 mt-1"
                      contain
                      max-width="29"
                      :src="`/${bone}v.png`"
                    />
                  </v-card>
                </v-card>
              </v-col>
            </v-row>
          </v-container>
        </v-sheet>
      </v-sheet>
      <div>
        <!-- THE PLAYING AREA -->
        <div>
          <div class="d-flex justify-space-around">
            <div class="d-flex flex-column align-center mb-6">
              <v-sheet width="200" height="115" color="#00000000" />
              <!-- LEFT PLAYER STATUS -->
              <StatusNew v-model="left" class="ma-6 mb-12" />
              <v-sheet width="200" height="90" color="#00000000">
                <div v-if="snack" class="pa-1 pt-3 text-center">
                  <h3 style="color: #6f6f6f;">
                    {{ snack }}
                  </h3>
                </div>
              </v-sheet>
            </div>

            <div class="d-flex flex-column align-center justify-space-around">
              <!-- TOP PLAYER STATUS -->
              <StatusNew v-model="top" class="ma-3 align-self-center" />

              <!-- CENTER STATUS AND POINTERS -->
              <div class="d-flex justify-space-around align-self-center">
                <div class="d-flex align-center justify-space-around mr-3">
                  <v-icon :color="pointLeft">
                    mdi-chevron-left
                  </v-icon>
                </div>
                <v-sheet height="140" width="180" class="d-flex flex-column align-self-center text-center justify-space-around">
                  <v-icon :color="pointUp">
                    mdi-chevron-up
                  </v-icon>
                  <h3 style="color: #6f6f6f;">
                    {{ choiceTitle }}
                  </h3>
                  <v-icon :color="pointDown">
                    mdi-chevron-down
                  </v-icon>
                </v-sheet>
                <div class="d-flex align-center justify-space-around ml-3">
                  <v-icon :color="pointRight">
                    mdi-chevron-right
                  </v-icon>
                </div>
              </div>
              <!-- MY STATUS -->
              <StatusNew v-model="me" :name="false" class="mt-6 mb-1 align-self-center" />
              <h2 class="mb-3" style="color: #6f6f6f;">
                {{ youAre }}
              </h2>
            </div>

            <div class="d-flex flex-column align-center mb-6">
              <v-sheet width="200" height="115" color="#00000000">
                <div v-if="rules" class="pa-3 pt-9 text-center">
                  <h5 style="color: #0049bd;">
                    {{ rules.join(' \u00b7 ') }}
                  </h5>
                </div>
              </v-sheet>
              <!-- RIGHT PLAYER STATUS -->
              <StatusNew v-model="right" class="ma-6 mb-12" />
            </div>
          </div>
        </div>
        <!-- THE CHOICE BAR -->
        <div>
          <v-sheet color="#0049bd" height="60" class="white--text d-flex align-center">
            <v-spacer />
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
                <v-progress-circular
                  v-if="timed"
                  v-model="timed"
                  class="ml-2"
                  size="18"
                  width="5"
                  color="white"
                />
              </v-chip>
            </div>
            <v-spacer />
          </v-sheet>
        </div>
        <!-- MY BONES -->
        <div class="mt-2">
          <v-sheet color="#8fa5b7" class="d-flex align-center justify-space-around pa-3">
            <v-img
              v-for="n in 4"
              :key="`t${n}`"
              :src="`/${bones[n - 1]}.png`"
              contain
              width="180"
              height="90"
              class="ma-2"
              @click="playBone(bones[n - 1])"
            >
              <template #default>
                <v-row
                  class="fill-height ma-0"
                  align="center"
                  justify="center"
                >
                  <v-img
                    v-if="possible && bones[n - 1] &&!possible.includes(bones[n - 1])"
                    width="180"
                    height="90"
                    src="/cover.png"
                    contain
                  />
                </v-row>
              </template>
            </v-img>
          </v-sheet>
          <v-sheet color="#8fa5b7" class="d-flex align-center justify-space-around pb-6 pl-12 pr-12">
            <v-img
              v-for="n in 3"
              :key="`b${n}`"
              :src="`/${bones[n + 3]}.png`"
              contain
              width="180"
              height="90"
              @click="playBone(bones[n + 3])"
            >
              <template #default>
                <v-row
                  class="fill-height ma-0"
                  align="center"
                  justify="center"
                >
                  <v-img
                    v-if="possible && bones[n + 3] && !possible.includes(bones[n + 3])"
                    width="180"
                    height="90"
                    src="/cover.png"
                    contain
                  />
                </v-row>
              </template>
            </v-img>
          </v-sheet>
        </div>
        <div class="text-right">
          <span class="caption">
            designed by
            <a href="https://www.nitecreative.com/" target="_blank">
              nite creative
            </a>
          </span>
        </div>
      </div>
    </div>
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
      rules: undefined,
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
      over: false,
      waitingForBid: undefined,
      bids: {},
      bidWinner: undefined,
      waitingForTrump: undefined,
      trump: {},
      waitingForPlay: undefined,
      plays: {},
      trickWinner: undefined,
      bones: ['null', 'null', 'null', 'null', 'null', 'null', 'null'],

      pointTo: [],
      choiceTitle: undefined,
      choices: [],
      timed: 0,
      choose: () => undefined,
      possible: undefined,
      snack: undefined
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
      if (event.reason === 'host-close') {
        this.choiceTitle = 'The host has closed the game'
        this.paused = true
        this.over = true
      }
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
    },
    pointUp () {
      if (this.pointTo.includes(this.top.name)) {
        return '#6f6f6f'
      }
      return '#00000000'
    },
    pointRight () {
      if (this.pointTo.includes(this.right.name)) {
        return '#6f6f6f'
      }
      return '#00000000'
    },
    pointDown () {
      if (this.pointTo.includes(this.me.name)) {
        return '#6f6f6f'
      }
      return '#00000000'
    },
    pointLeft () {
      if (this.pointTo.includes(this.left.name)) {
        return '#6f6f6f'
      }
      return '#00000000'
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
    showSnack (value) {
      this.snack = value
      setTimeout(() => {
        this.snack = undefined
      }, 3500)
    },
    async handleMessage (type, message, ack) {
      console.log(ack || '', type, message)
      switch (type) {
        case 'welcome':
          this.youAre = message.youAre
          this.send('info', {
            screenW: window.screen.width,
            screenH: window.screen.height,
            innerW: window.innerWidth,
            innerH: window.innerHeight
          })
          break

        case 'startingGame':
          this.rules = message.desc
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

        case 'declined':
          this.choiceTitle = `${message.name} declined the invitation to play, the game is over`
          this.ws = undefined
          this.paused = true
          this.over = true
          this.connected = []
          break

        case 'startingHand':
          this.pointTo = [this.youAre]
          await this.prompt('Ready to start the next hand?', ['Yes'], 5)
          this.US.points = undefined
          this.THEM.points = undefined
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
          this.pointTo = [message.from]
          break

        case 'bid':
          this.waitingForBid = this.youAre
          this.pointTo = [this.youAre]
          this.prompt('Your bid', message.possible).then((bid) => {
            this.waitingForBid = undefined
            this.bids[this.youAre] = bid
            this.send('submitBid', { bid: `#bid:${bid}` }, ack)
          })
          break

        case 'bidSubmitted':
          this.waitingForBid = undefined
          this.bids[message.from] = message.bid
          this.pointTo = [message.from]
          break

        case 'reshuffle':
          this.pointTo = []
          this.bids = {}
          break

        case 'bidWon':
          this.bids = { [message.from]: message.bid }
          this.bidWinner = message.from
          this.US.points = 0
          this.THEM.points = 0
          this.choiceTitle = `${message.from} bid ${message.bid}`
          this.pointTo = [this.bidWinner]
          break

        case 'waitingForTrump':
          this.waitingForTrump = message.from
          this.pointTo = [message.from]
          break

        case 'call':
          this.waitingForTrump = this.youAre
          this.pointTo = [this.youAre]
          this.prompt('Call trumps', message.possible).then((trump) => {
            this.trump = { [this.youAre]: trump }
            this.send('callTrump', { trump: `#trump:${trump}` }, ack)
          })
          break

        case 'trumpSubmitted':
          this.waitingForTrump = undefined
          this.trump = { [message.from]: message.trump }
          this.choiceTitle = `Trumps are ${message.trump}`
          this.pointTo = [message.from]
          break

        case 'waitingForPlay':
          this.waitingForPlay = message.from
          this.pointTo = [message.from]
          break

        case 'play':
          this.waitingForPlay = this.youAre
          this.pointTo = [this.youAre]
          this.possible = message.possible
          this.prompt('What will it be?', message.possible).then((bone) => {
            this.possible = undefined
            this.plays[this.youAre] = bone
            this.bones[this.bones.indexOf(bone)] = null
            this.send('play', { bone: `#bone:${bone}` }, ack)
          })
          break

        case 'playSubmitted':
          this.waitingForPlay = undefined
          this.plays[message.from] = message.bone
          this.pointTo = [message.from]
          break

        case 'endOfTrick':
          this.trickWinner = message.winner
          this.US = message.status.US
          this.THEM = message.status.THEM
          if (message.status.renege) {
            this.pointTo = [message.status.renege]
            await this.prompt(`${message.status.renege} didn't follow suit, the hand goes to the other team`, ['Continue'], 3)
          } else {
            this.pointTo = [message.winner]
            await this.prompt(`${message.winner} won the trick with ${message.points} point${message.points === 1 ? '' : 's'}`, ['Next trick'], 3)
          }
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
            const title = `${players.join(' and ')} won the hand`
            this.US = message.status.US
            this.THEM = message.status.THEM
            this.pointTo = players
            this.showSnack(title)
            this.send('readyToContinue', null, ack)
          }
          break

        case 'gameOver':
          this.pointTo = [this.youAre]
          if (this.hosting) {
            const title = 'The game is over, would you like to play again?'
            const response = await this.prompt(title, ['Play again', 'Close'])
            if (response === 'Close') {
              this.ws.close(1000, 'host-close')
              setTimeout(() =>
                window.location.replace('https://fortee2.slack.com/'), 1000)
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

        case 'gameError':
          if (message.error === 'expired') {
            this.choiceTitle = 'This game expired'
          } else {
            this.choiceTitle = 'There was a bug in the game, it cannot continue'
          }
          this.ws.close(1000, 'game-error')
          this.ws = undefined
          this.paused = true
          this.over = true
          this.connected = []
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
        over: this.over,
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
    prompt (title, choices, timed) {
      this.choiceTitle = title
      this.choices = choices
      return new Promise((resolve) => {
        const total = typeof timed === 'number' ? timed : 10
        let interval
        let seconds = total
        if (timed) {
          this.timed = 100
          interval = setInterval(() => {
            seconds--
            this.timed = 100 * (seconds / total)
            if (seconds <= 0) {
              this.choose(choices[0])
            }
          }, 1000)
        }
        this.choose = (value) => {
          this.choiceTitle = undefined
          this.choices = []
          this.timed = 0
          if (interval) {
            clearInterval(interval)
          }
          resolve(value)
        }
      })
    },
    playBone (bone) {
      if (this.choices.includes(bone)) {
        this.choose(bone)
      }
    }
  }
}
</script>
