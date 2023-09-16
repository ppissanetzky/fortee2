<template>
  <div>
    <div class="d-flex flex-column">
      <!-- VERY TOP - BLUE STATUS BAR -->
      <v-sheet class="d-flex" color="#0049bd" width="814" min-width="814">
        <div class="d-flex px-2 py-2">
          <div class="white--text mr-6">
            <div class="subtitle-1">
              {{ teams.US[0] }} & {{ teams.US[1] }}
            </div>
            <div class="subtitle-1">
              {{ teams.THEM[0] }} & {{ teams.THEM[1] }}
            </div>
          </div>
          <div class="white--text mr-6">
            <h3>{{ US.marks }}</h3>
            <h3>{{ THEM.marks }}</h3>
          </div>
          <div class="white--text mr-6">
            <div v-if="bidWinner">
              <div v-if="teamFor(bidWinner) === 'US'">
                <span class="subtitle-1">{{ bidWinner }} bid <strong>{{ bids[bidWinner] }}</strong></span>
                <span v-if="trump" class="subtitle-1"> on <strong>{{ trump }}</strong></span>
              </div>
              <v-sheet v-else width="0" height="28" />
            </div>
            <div v-if="bidWinner">
              <div v-if="teamFor(bidWinner) === 'THEM'">
                <span class="subtitle-1">{{ bidWinner }} bid <strong>{{ bids[bidWinner] }}</strong></span>
                <span v-if="trump" class="subtitle-1"> on <strong>{{ trump }}</strong></span>
              </div>
              <v-sheet v-else width="0" height="28" />
            </div>
          </div>
        </div>
        <v-spacer />
        <div v-if="rules" class="d-flex align-end pa-2 pr-3 mb-1">
          <v-menu offset-y>
            <template #activator="{ on, attrs }">
              <v-btn small outlined class="white--text" v-bind="attrs" v-on="on">
                <v-icon left>
                  mdi-text-box-check-outline
                </v-icon>
                rules
              </v-btn>
            </template>
            <human-rules v-model="rules" />
          </v-menu>
        </div>
      </v-sheet>

      <!-- TOP - BONE PILE AND PLAY AREA -->
      <div class="d-flex">
        <!-- LEFT - PILE -->
        <div class="d-flex">
          <v-sheet class="d-flex flex-column fill-height px-2" min-width="150" width="150" color="#c0d4e5">
            <div v-if="pile.US.length" class="d-flex">
              <div class="d-flex caption ml-1">
                <strong>{{ US.points }}</strong>
              </div>
              <v-progress-linear
                class="d-flex align-self-center ml-2 mr-1"
                height="10"
                :value="bidPercentage('US')"
                :color="bidColor('US')"
              />
            </div>
            <v-card
              v-for="(trick, index) in stack ? pile.US.slice(-2) : pile.US"
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
            <div v-if="pile.THEM.length" class="d-flex mt-1">
              <div class="d-flex caption ml-1">
                <strong>{{ THEM.points }}</strong>
              </div>
              <v-progress-linear
                class="d-flex align-self-center ml-2 mr-1"
                height="10"
                :value="bidPercentage('THEM')"
                :color="bidColor('THEM')"
              />
            </div>
            <v-card
              v-for="(trick, index) in stack ? pile.THEM.slice(-2) : pile.THEM"
              :key="`THEM-${index}`"
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
          </v-sheet>
        </div>
        <!-- RIGHT - PLAY AREA -->
        <div class="d-flex mx-8 flex-column">
          <div class="d-flex justify-space-around">
            <div class="d-flex flex-column align-center justify-space-around">
              <!-- LEFT PLAYER STATUS -->
              <StatusNew v-model="left" class="ma-3" />
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
                  <!-- CENTER CHOICE -->
                  <div>
                    <div v-if="!choices || timed">
                      <h4 style="color: #6f6f6f;">
                        {{ choiceTitle }}
                      </h4>
                      <div v-if="choices" class="mt-3">
                        <v-chip
                          v-for="c in choices"
                          :key="c"
                          label
                          color="#ff3600"
                          class="mr-1 white--text"
                          @click="choose(c)"
                        >
                          <strong>{{ c }}</strong>
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
                    </div>
                    <div v-else-if="choiceTitle && choices.length > 1 && !watching && !paused">
                      <h4 style="color: #6f6f6f;">
                        {{ choiceTitle }}
                      </h4>
                    </div>
                  </div>
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
              <StatusNew v-model="me" :name="false" class="ma-3 align-self-center" />
            </div>

            <div class="d-flex flex-column align-center justify-space-around">
              <!-- RIGHT PLAYER STATUS -->
              <StatusNew v-model="right" class="ma-3" />
            </div>
          </div>
          <!-- BELOW PLAYING AREA - YOUR NAME AND SNACK -->
          <v-sheet class="d-flex flex-column" height="132">
            <span class="text-center text-h6" :style="bidWinner === youAre ? 'color: #0049bd;' : 'color: #6f6f6f;'">
              <strong>{{ youAre }}</strong>
            </span>
            <v-card
              v-if="snack"
              flat
              outlined
              class="mt-3 pa-3"
              color="#c0d4e5"
              style="border-color: #525252; border-width: 2px; border-radius: 9px;"
            >
              <h3 class="text-center" style="color: #525252;">
                {{ snack }}
              </h3>
            </v-card>
            <v-sheet
              v-else-if="choiceTitle && choices && choices.length > 1 && !watching && !paused"
              class="d-flex mt-3 align-self-center"
              max-width="140"
            >
              <v-select
                v-model="choice"
                :items="choices"
                :label="choiceTitle"
                hide-details
                dense
                outlined
                max-width="140"
              />
            </v-sheet>
          </v-sheet>
        </div>
        <!-- FAR RIGHT - BORDER -->
        <div class="d-flex">
          <v-sheet class="d-flex fill-height" color="#8fa5b7" width="12" />
        </div>
      </div>
      <!-- BOTTOM - CHAT AND MY BONES -->
      <div class="d-flex">
        <v-sheet class="d-flex pl-1 flex-column" color="#8fa5b7" width="150" min-width="150">
          <v-card
            id="chat-box"
            height="133"
            flat
            tile
            outlined
            class="d-flex overflow-y-auto flex-column mt-2"
            style="border-color: #0000006b;"
          >
            <div v-for="m in messages" :key="m.id" class="mb-1 mx-1" style="line-height: 50%;">
              <span class="body-2"><strong>{{ m.name }} </strong>{{ m.text }}</span>
            </div>
          </v-card>
          <v-form @submit.prevent="() => void 0" @submit="chat">
            <v-text-field
              v-model="message"
              color="#0049bd"
              dense
              outlined
              placeholder="chat..."
              hide-details
              append-icon="mdi-send"
              class="d-flex mt-1 body-2"
              style="background-color: white;border-radius: 0;"
              @click:append="chat"
            />
          </v-form>
        </v-sheet>
        <div>
          <v-sheet color="#8fa5b7" class="d-flex align-center justify-space-around px-3 py-2">
            <v-img
              v-for="n in 4"
              :key="`t${n}`"
              :src="`/${bones[n - 1]}.png`"
              contain
              width="144"
              height="72"
              class="ma-2"
              draggable="true"
              @dragstart="(event) => dragStart(event, n - 1)"
              @drop="(event) => drop(event, n - 1)"
              @dragover="(event) => dragOver(event, n - 1)"
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
                    width="144"
                    height="72"
                    src="/cover.png"
                    contain
                  />
                </v-row>
              </template>
            </v-img>
          </v-sheet>
          <v-sheet color="#8fa5b7" class="d-flex align-center justify-space-around pb-3 pl-12 pr-12">
            <v-img
              v-for="n in 3"
              :key="`b${n}`"
              :src="`/${bones[n + 3]}.png`"
              contain
              width="144"
              height="72"
              draggable="true"
              @dragstart="(event) => dragStart(event, n + 3)"
              @drop="(event) => drop(event, n + 3)"
              @dragover="(event) => dragOver(event, n + 3)"
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
                    width="144"
                    height="72"
                    src="/cover.png"
                    contain
                  />
                </v-row>
              </template>
            </v-img>
          </v-sheet>
        </div>
      </div>
      <!-- <v-sheet class="text-right" color="#8fa5b7">
        <div class="caption pr-3 pb-2">
          designed by
          <a href="https://www.nitecreative.com/" target="_blank">
            nite creative
          </a>
        </div>
      </v-sheet> -->
    </div>
  </div>
</template>
<script>
import StatusNew from '~/components/status-new.vue'
function reviver (key, value) {
  if (typeof value === 'string') {
    return value.replace(/^#(bid|bone|trump):/, '')
  }
  return value
}
const backgroundMessages = new Set([
  'chat',
  'gameIdle',
  'alive'
])
export default {
  components: { StatusNew },
  data () {
    return {
      ws: undefined,
      // This person's user name
      youAre: undefined,
      // This person's full user
      you: {},
      // The room token we're watching
      watching: undefined,
      // The room we're joining
      join: undefined,
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
      trump: undefined,
      waitingForPlay: undefined,
      plays: {},
      trickWinner: undefined,
      bones: ['null', 'null', 'null', 'null', 'null', 'null', 'null'],
      stack: false,
      // Chat
      messages: [],
      message: undefined,

      pointTo: [],
      choiceTitle: undefined,
      choices: [],
      choice: undefined,
      timed: 0,
      choose: () => undefined,
      possible: undefined,
      snack: undefined,

      queue: Promise.resolve(),
      snackTimeout: undefined,
      ingress: Promise.resolve()
    }
  },
  fetch () {
    /** Preload all the bone images */
    for (let i = 0; i < 7; i++) {
      for (let j = i; j < 7; j++) {
        const [a, b] = [i, j].sort().reverse()
        new Image().src = `${a}.${b}.png`
        new Image().src = `${a}.${b}v.png`
      }
    }
    const { watch, join } = this.$route.query
    if (join) {
      this.join = join
    } else if (watch) {
      this.watching = watch
    } else {
      return
    }
    this.connect()
  },
  computed: {
    left () { return this.status(1) },
    top () { return this.status(2) },
    right () { return this.status(3) },
    me () { return this.status(0) },
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
  watch: {
    choice (value) {
      if (this.choose && !this.watching) {
        this.choose(value)
      }
    }
  },
  mounted () {},
  methods: {
    connect () {
      const version = encodeURIComponent(this.$config.version)
      const path = this.watching
        ? `watch/${this.watching}?v=${version}`
        : `join/${this.join}?v=${version}`
      let url = `wss://${window.location.hostname}/${path}`
      if (process.env.NUXT_ENV_DEV) {
        url = `ws://${window.location.hostname}:4004/${path}`
      }
      // eslint-disable-next-line no-console
      console.log('connecting...')
      const ws = new WebSocket(url)
      ws.onopen = () => {
        // eslint-disable-next-line no-console
        console.log('connected')
        this.ws = ws
        this.ws.onmessage = (event) => {
          const { ack, type, message } = JSON.parse(event.data, reviver)
          if (backgroundMessages.has(type)) {
            return this.handleMessage(type, message, ack)
          }
          // Queue handling of this message
          this.ingress = this.ingress.then(() =>
            this.handleMessage(type, message, ack))
        }
        // Once connected, we will close the socket on an error, which
        // should cause it to reconnect
        ws.onerror = (event) => {
          // eslint-disable-next-line no-console
          console.log('error', event)
          ws.close()
        }
        ws.onclose = (event) => {
          this.ws = undefined
          // Get rid of any choice that is on the screen
          this.choose(new Error('Socket closed'))
          const { code, reason } = event
          // eslint-disable-next-line no-console
          console.log('closed', code, reason, event.wasClean)
          // Code 4000 is an explicit server close, it is expected
          if (code === 4000) {
            this.over = true
            this.showSnack('The game is over, you can close this tab', Infinity)
            switch (reason) {
              case 'game-over':
                break
              case 'game-expired':
                this.showTitle('The game timed out')
                break
              case 'game-error':
                this.showTitle('There was an error with the game')
                break
              case 'new-connection':
                this.showSnack('You connected from another tab, this one will not work', Infinity)
                this.showTitle('You connected from another tab')
                break
            }
          } else {
            setTimeout(() => {
              // eslint-disable-next-line no-console
              console.log('reconnecting')
              this.connect()
            }, 1)
          }
        }
      }
      // This should be an error when trying to connect, so we show a message
      ws.onerror = (event) => {
        // eslint-disable-next-line no-console
        console.log('error', event)
        this.showTitle('There was a problem connecting')
        this.paused = true
        this.over = true
      }
    },
    send (type, message, ack) {
      if (this.ws) {
        this.ws.send(JSON.stringify({
          type,
          ack,
          message: message || {}
        }))
      }
    },
    showSnack (value, seconds) {
      this.snack = value
      clearTimeout(this.snackTimeout)
      this.snackTimeout = undefined
      if (seconds !== Infinity) {
        this.snackTimeout = setTimeout(() => {
          this.snackTimeout = undefined
          this.snack = undefined
        }, seconds ? seconds * 1000 : 3500)
      }
    },
    async handleMessage (type, message, ack) {
      // eslint-disable-next-line no-console
      console.log(ack || '', type, message)
      switch (type) {
        case 'welcome':
          this.youAre = message.youAre
          this.you = message.you
          this.send('info', {
            screenW: window.screen.width,
            screenH: window.screen.height,
            innerW: window.innerWidth,
            innerH: window.innerHeight
          })
          break

        case 'startingGame':
          this.rules = message.rules
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
          this.showTitle(`${message.name} declined the invitation to play, the game is over`)
          this.ws = undefined
          this.paused = true
          this.over = true
          this.connected = []
          break

        case 'startingHand':
          this.pointTo = [this.youAre]
          if (!this.watching) {
            await this.prompt('Ready to start the next hand?', ['Yes'], 5)
          }
          this.US.points = undefined
          this.THEM.points = undefined
          this.bids = {}
          this.trump = undefined
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
          {
            this.waitingForBid = this.youAre
            this.pointTo = [this.youAre]
            const bid = await this.prompt('Your bid', message.possible)
            this.waitingForBid = undefined
            this.bids[this.youAre] = bid
            this.send('submitBid', { bid: `#bid:${bid}` }, ack)
          }
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
          this.stack = message.bid.includes('mark')
          this.US.points = 0
          this.THEM.points = 0
          this.showTitle(`${message.from} bid ${message.bid}`)
          this.pointTo = [this.bidWinner]
          await this.delay(2)
          break

        case 'waitingForTrump':
          this.waitingForTrump = message.from
          this.pointTo = [message.from]
          break

        case 'call':
          {
            this.waitingForTrump = this.youAre
            this.pointTo = [this.youAre]
            const trump = await this.prompt('Call trumps', message.possible)
            this.trump = trump
            this.send('callTrump', { trump: `#trump:${trump}` }, ack)
          }
          break

        case 'trumpSubmitted':
          this.waitingForTrump = undefined
          this.trump = message.trump
          this.showTitle(`Trumps are ${message.trump}`)
          this.pointTo = [message.from]
          break

        case 'waitingForPlay':
          this.waitingForPlay = message.from
          this.pointTo = [message.from]
          break

        case 'play':
          {
            this.waitingForPlay = this.youAre
            this.pointTo = [this.youAre]
            this.possible = message.possible
            const bone = await this.prompt('What will it be?')
            this.possible = undefined
            this.plays[this.youAre] = bone
            this.bones[this.bones.indexOf(bone)] = null
            this.send('play', { bone: `#bone:${bone}` }, ack)
          }
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
            this.showTitle(`${message.winner} won the trick with ${message.points} point${message.points === 1 ? '' : 's'}`)
            await this.delay(2.5)
          }
          this.choiceTitle = undefined
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
          {
            const team = message.status.winner
            const players = this.table
              .filter(({ name }) => this.teamFor(name) === team)
              .map(({ name }) => name)
            this.pointTo = players
            this.showTitle(`${players.join(' and ')} won the game!`)
            this.ws = undefined
            this.paused = true
            this.over = true
            this.connected = []
          }
          break

        case 'gameError':
          if (message.error === 'expired') {
            this.showTitle('This game timed out')
          } else {
            this.showTitle('There was a bug in the game, it cannot continue')
          }
          this.ws = undefined
          this.paused = true
          this.over = true
          this.connected = []
          break

        case 'gameState':
          for (const [key, value] of Object.entries(message)) {
            this[key] = value
          }
          break

          // Background messages

        case 'alive':
          this.send('readyToContinue', null, ack)
          break

        case 'gameIdle':
          if (message.time) {
            this.showSnack(`The game has been stuck for ${message.idle} and will time out in ${message.expiresIn}`, 8)
          }
          this.send('readyToContinue', null, ack)
          break

        case 'chat':
          this.messages = [...this.messages, ...message]
          this.scrollChat()
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
        return {
          over: true
        }
      }
      return {
        name,
        over: this.over,
        connected: this.connected.includes(name),
        bot: this.bots.includes(name),
        waitingForBid: this.waitingForBid === name,
        bid: this.bids[name],
        waitingForTrump: this.waitingForTrump === name,
        trump: this.trump,
        waitingForPlay: this.waitingForPlay === name,
        play: this.plays[name],
        trickWinner: this.trickWinner === name,
        bidWinner: this.bidWinner === name
      }
    },
    showTitle (title) {
      this.choices = undefined
      this.choiceTitle = title
    },
    prompt (title, choices, timed) {
      this.choice = undefined
      this.choiceTitle = title
      this.choices = choices
      this.queue = this.queue.then(() => new Promise((resolve, reject) => {
        const total = typeof timed === 'number' ? timed : 10
        let interval
        let seconds = total
        if (timed) {
          this.timed = 100
          interval = setInterval(() => {
            seconds--
            this.timed = 100 * (seconds / total)
            if (seconds <= 0) {
              clearInterval(interval)
              this.choose(choices[0])
            }
          }, 1000)
        }
        this.choose = (value) => {
          clearInterval(interval)
          this.choose = () => undefined
          this.choiceTitle = undefined
          this.choices = []
          this.timed = 0
          if (value instanceof Error) {
            return reject(value)
          }
          resolve(value)
        }
      })).catch(() => undefined)
      return this.queue
    },
    playBone (bone) {
      if (this.watching) {
        return
      }
      if (this.possible?.includes(bone)) {
        this.choose(bone)
      }
    },
    dragStart (event, n) {
      event.dataTransfer.setData('text/plain', n)
      event.dataTransfer.dropEffect = 'move'
      const image = new Image()
      image.src = `/${this.bones[n]}.png`
      event.dataTransfer.setDragImage(image, 90, 45)
    },
    drop (event, n) {
      event.preventDefault()
      const other = parseInt(event.dataTransfer.getData('text/plain'), 10)
      const swap = this.bones[n]
      this.bones.splice(n, 1, this.bones[other])
      this.bones.splice(other, 1, swap)
    },
    dragOver (event, n) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
    },
    bidPercentage (team) {
      const bid = this.bids[this.bidWinner]
      if (!bid) {
        return 0
      }
      let max = bid.length === 2 ? parseInt(bid, 10) : 42
      const biddingTeam = this.teamFor(this.bidWinner)
      if (biddingTeam !== team) {
        max = 43 - max
      }
      const value = team === 'US'
        ? this.US.points
        : this.THEM.points
      return Math.min(100, 100 * (value / max))
    },
    bidColor (team) {
      return team === this.teamFor(this.bidWinner) ? 'green' : '#ff3600'
    },
    chat () {
      const { message, ws } = this
      if (message && ws) {
        // Only TDs that are watching can chat
        if (this.watching && !this.you.roles?.includes('td')) {
          return
        }
        ws.send(JSON.stringify({ type: 'chat', message }))
        this.message = undefined
      }
    },
    scrollChat () {
      setTimeout(() => {
        const box = document.getElementById('chat-box')
        box.scrollTop = box.scrollHeight
      }, 0)
    },
    async delay (s) {
      await new Promise(resolve => setTimeout(resolve, s * 1000))
    }
  }
}
</script>
