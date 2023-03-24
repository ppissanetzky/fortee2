<template>
  <v-app>
    <v-main>
      <v-card flat max-width="960px">
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
                    <div v-if="active" ext-h2 flex-grow-1 text-center />
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
                    <div v-if="active" ext-h2 flex-grow-1 text-center />
                  </v-img>
                </v-item>
              </v-col>
            </v-row>
          </v-container>
        </v-item-group>
        <v-container>
          <v-row>
            <v-col cols="4">
              <v-textarea
                v-model="text"
                outlined
                no-resize
                readonly
                rows="10"
              />
            </v-col>
            <v-col cols="4">
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
      </v-card>
    </v-main>
  </v-app>
</template>
<script>
export default {
  data () {
    return {
      ws: undefined,
      joining: false,
      text: '',
      bones: [],
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
  },
  watch: {
  },
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
          this.send('inviteBot', { fillRoom: true })
          break

        case 'enteredGameRoom':
          if (message.full) {
            this.send('startGame')
          }
          break

        case 'startingHand':
          this.choices = ['Ready?']
          this.choose = () => {
            this.text = ''
            this.choices = []
            this.send('readyToStartHand', null, ack)
          }
          break

        case 'draw':
          this.bones = message.bones
            .map(bone => bone.replace('#bone:', '').replace('.', ''))
          break

        case 'waitingForBid':
          this.text += `\nWaiting for ${message.from} to bid`
          break

        case 'bid':
          this.text += '\nYour bid'
          this.choices = message.possible
          this.choose = (bid) => {
            this.choices = []
            this.send('submitBid', { bid: `#bid:${bid}` }, ack)
          }
          break

        case 'bidSubmitted':
          this.text += `\n${message.from} bid ${message.bid}`
          break

        case 'reshuffle':
          this.text += '\nReshuffle'
          break

        case 'bidWon':
          this.text += `\n${message.winner} wond the bid with ${message.bid}`
          break

        case 'waitingForTrump':
          this.text += `\nWaiting for ${message.from} to call trumps`
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
          break

        case 'waitingForPlay':
          this.text += `\nWaiting for ${message.from} to play`
          break

        case 'play':
          this.text += '\nYour turn'
          this.choices = message.possible
          this.choose = (bone) => {
            this.choices = []
            this.bones[this.bones.indexOf(bone.replace('.', ''))] = ''
            this.send('play', { bone: `#bone:${bone}` }, ack)
          }
          break

        case 'playSubmitted':
          this.text += `\n${message.from} played the ${message.bone}`
          break

        case 'endOfTrick':
          this.text += `\n${message.winner} won the trick with ${message.points}`
          break

        case 'endOfHand':
          this.text += `\n${message.winner} wins the hand\nUS ${message.status.US.marks} THEM ${message.status.THEM.marks}`
          break

        case 'gameOver':
          this.text = `\nGame over\nUS ${message.status.US.marks} THEM ${message.status.THEM.marks}`
          break
      }
    }
  }
}
</script>
