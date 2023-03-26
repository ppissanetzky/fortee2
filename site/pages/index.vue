<template>
  <v-app>
    <v-main>
      <v-container>
        <v-row>
          <v-col cols="4" />
          <v-col cols="4">
            <Status v-model="top" color="secondary" />
          </v-col>
          <v-col cols="4" />
        </v-row>
        <v-row>
          <v-col cols="4">
            <Status v-model="left" color="primary" />
          </v-col>
          <v-col cols="4" />
          <v-col cols="4">
            <Status v-model="right" color="primary" />
          </v-col>
        </v-row>
        <!-- My stuff -->
        <v-row>
          <v-col cols="12">
            <v-item-group active-class="primary">
              <v-container>
                <v-row>
                  <v-col
                    v-for="n in 4"
                    :key="n"
                    cols="3"
                  >
                    <v-item v-slot="{ active, toggle }">
                      <v-img
                        :src="`${bones[n - 1]}.png`"
                        contain
                        @click="toggle"
                      >
                      <div v-if="active" ext-h2 flex-grow-1 text-center></div>
                      </v-img>
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
                    <v-item v-slot="{ active, toggle }">
                      <v-img
                        :src="`${bones[n + 3]}.png`"
                        contain
                        @click="toggle"
                      >
                      <div v-if="active" ext-h2 flex-grow-1 text-center>
                      </div>
                      </v-img>
                    </v-item>
                  </v-col>
                </v-row>
              </v-container>
            </v-item-group>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <v-btn
              v-for="choice in choices"
              :key="choice"
              class="ma-1"
              @click="choose(choice)"
            >
              {{ choice }}
            </v-btn>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>
<script>
import Status from '~/components/status.vue'
export default {
  components: { Status },
  data () {
    return {
      ws: undefined,
      joining: false,
      table: [],
      waitingForBid: undefined,
      bids: {},
      waitingForTrump: undefined,
      trump: {},
      waitingForPlay: undefined,
      plays: {},
      text: '',
      bones: ['null', 'null', 'null', 'null', 'null', 'null', 'null'],
      choices: [],
      choose: () => undefined
    }
  },
  async fetch () {
    await this.$axios.$post('/api/local-login', {
      username: 'pablo',
      password: 'Sl5px1qZfMp27a1sIm+tA7WKkjn05t2AGuebf+kuCl5A0XdVDQpzCx6Qw01PL5gzHxMffjuVSKS9d6iUUjyew=='
    })
    this.joining = true
    let port = parseInt(window.location.port || '80', 10)
    port = 4003
    const url = `ws://${window.location.hostname}:${port + 1}/ws`
    const ws = new WebSocket(url)
    ws.onclose = (event) => {
      this.ws = undefined
    }
    // ws.addEventListener('error', (event) => {
    //   console.log(event)
    // })
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
    left () {
      return this.status(0)
    },
    top () {
      return this.status(1)
    },
    right () {
      return this.status(2)
    }
  },
  watch: {},
  mounted () {
  },
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
    handleMessage (type, message, ack) {
      console.log(ack || '', type, message)
      switch (type) {
        case 'welcome':
          this.send('createGame')
          break
        case 'youEnteredGameRoom':
          this.table = message.bots.map(name => ({
            name
          }))
          this.send('inviteBot', { fillRoom: true })
          break
        case 'enteredGameRoom':
          this.table = message.bots.map(name => ({
            name
          }))
          if (message.full) {
            this.send('startGame')
          }
          break
        case 'startingHand':
          this.bids = {}
          this.trump = {}
          this.choices = ['Ready?']
          this.choose = () => {
            this.text = ''
            this.choices = []
            this.send('readyToStartHand', null, ack)
          }
          break
        case 'draw':
          this.bones = message.bones
          break
        case 'waitingForBid':
          this.text += `\nWaiting for ${message.from} to bid`
          this.waitingForBid = message.from
          break
        case 'bid':
          this.text += '\nYour bid'
          this.waitingForBid = undefined
          this.choices = message.possible
          this.choose = (bid) => {
            this.choices = []
            this.send('submitBid', { bid: `#bid:${bid}` }, ack)
          }
          break
        case 'bidSubmitted':
          this.text += `\n${message.from} bid ${message.bid}`
          this.waitingForBid = undefined
          this.bids[message.from] = message.bid
          break
        case 'reshuffle':
          this.text += '\nReshuffle'
          this.bids = {}
          break
        case 'bidWon':
          this.text += `\n${message.winner} won the bid with ${message.bid}`
          this.bids = { [message.winner]: message.bid }
          break
        case 'waitingForTrump':
          this.text += `\nWaiting for ${message.from} to call trumps`
          this.waitingForTrump = message.from
          break
        case 'call':
          this.text += '\nYou call trumps'
          this.choices = message.possible
          this.choose = (trump) => {
            this.choices = []
            this.send('callTrump', { trump: `#trump:${trump}` }, ack)
          }
          break
        case 'trumpSubmitted':
          this.text += `\n${message.from} called trumps ${message.trump}`
          this.waitingForTrump = undefined
          this.trump = { [message.from]: message.trump }
          break
        case 'waitingForPlay':
          this.text += `\nWaiting for ${message.from} to play`
          this.waitingForPlay = message.from
          break
        case 'play':
          this.text += '\nYour turn'
          this.choices = message.possible
          this.choose = (bone) => {
            this.choices = []
            this.bones[this.bones.indexOf(bone)] = 'null'
            this.send('play', { bone: `#bone:${bone}` }, ack)
          }
          break
        case 'playSubmitted':
          this.text += `\n${message.from} played the ${message.bone}`
          this.waitingForPlay = undefined
          this.plays[message.from] = message.bone
          break
        case 'endOfTrick':
          this.text += `\n${message.winner} won the trick with ${message.points}`
          this.plays = {}
          break
        case 'endOfHand':
          this.text += `\n${message.winner} wins the hand\nUS ${message.status.US.marks} THEM ${message.status.THEM.marks}`
          break
        case 'gameOver':
          this.text = `\nGame over\nUS ${message.status.US.marks} THEM ${message.status.THEM.marks}`
          break
      }
    },
    status (index) {
      const name = this.table[index]?.name
      if (!name) {
        return {}
      }
      return {
        name,
        waitingForBid: this.waitingForBid === name,
        bid: this.bids[name],
        waitingForTrump: this.waitingForTrump === name,
        trump: this.trump[name],
        waitingForPlay: this.waitingForPlay === name,
        play: this.plays[name]
      }
    }
  }
}
</script>
