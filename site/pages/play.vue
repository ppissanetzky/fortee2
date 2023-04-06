<template>
  <v-container fluid>
    <v-row>
      <v-col cols="3" class="pr-1 pl-1">
        <v-card flat>
          <v-container>
            <v-row>
              <v-col cols="8">
                <strong>US</strong>
                <br>
                <span class="caption">{{ me.name }} & {{ top.name }}</span>
              </v-col>
              <v-col>
                <h3>{{ US.marks }}</h3>
                <span class="caption">{{ US.points }}</span>
                <span v-if="bidForTeam('US')" class="caption">/ {{ bidForTeam('US') }}</span>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12">
                <v-divider />
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="8">
                <strong>THEM</strong>
                <br>
                <span class="caption">{{ left.name }} & {{ right.name }}</span>
              </v-col>
              <v-col>
                <h3>{{ THEM.marks }}</h3>
                <span class="caption">{{ THEM.points }}</span>
                <span v-if="bidForTeam('THEM')" class="caption">/ {{ bidForTeam('THEM') }}</span>
              </v-col>
            </v-row>
            <v-row
              v-for="(trick, index) in pile"
              :key="index"
              class="ma-0 mb-2 mt-4 pa-0"
            >
              <v-container>
                <v-row>
                  <v-col
                    v-for="bone in trick"
                    :key="bone"
                    cols="3"
                    class="ma-0 pa-0 pb-1"
                  >
                    <v-img
                      contain
                      max-width="40"
                      :src="`/${bone}v.png`"
                    />
                  </v-col>
                </v-row>
              </v-container>
            </v-row>
          </v-container>
        </v-card>
      </v-col>
      <v-col cols="9">
        <v-container class="pa-0">
          <v-row>
            <v-col cols="4" />
            <v-col cols="4">
              <Status v-model="top" color="secondary" />
            </v-col>
            <v-col cols="4" />
          </v-row>
          <v-row>
            <v-col cols="4">
              <Status v-model="left" color="red darken-4" />
            </v-col>
            <v-col cols="4" />
            <v-col cols="4">
              <Status v-model="right" color="red darken-4" />
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="4" />
            <v-col cols="4">
              <Status v-model="me" color="secondary" />
            </v-col>
            <v-col cols="4">
              <v-card
                flat
                width="280"
              >
                <p v-if="paused">
                  Waiting for players to join
                </p>
                <p v-else-if="choiceTitle">
                  {{ choiceTitle }}
                </p>
                <div v-if="!paused">
                  <v-chip
                    v-for="choice in choices"
                    :key="choice"
                    small
                    label
                    color="primary"
                    class="mr-1 mb-1"
                    @click="choose(choice)"
                  >
                    {{ choice }}
                  </v-chip>
                </div>
              </v-card>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12">
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
            </v-col>
          </v-row>
        </v-container>
      </v-col>
    </v-row>
    <!-- My stuff -->
  </v-container>
</template>
<script>
import Status from '~/components/status.vue'
export default {
  components: { Status },
  data () {
    return {
      ws: undefined,
      joining: false,
      youAre: undefined,
      hosting: false,
      US: {
        marks: 0,
        points: undefined
      },
      THEM: {
        marks: 0,
        points: undefined
      },
      table: [],
      connected: [],
      paused: true,
      waitingForBid: undefined,
      bids: {},
      bidWinner: undefined,
      waitingForTrump: undefined,
      trump: {},
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
      console.log('close', event)
      this.ws = undefined
      window.location.replace('/200.html')
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
