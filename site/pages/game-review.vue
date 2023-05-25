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
    </v-toolbar>
    <v-sheet class="d-flex flex-column pt-3" max-width="1000">
      <div class="px-3">
        <p>To search for a game, enter the date and part of any player's name. Once you find the game, select it to review it.</p>
      </div>
      <v-toolbar>
        <v-menu
          ref="menu"
          v-model="menu"
          :close-on-content-click="false"
          :return-value.sync="date"
          transition="scale-transition"
          offset-y
          min-width="auto"
        >
          <template #activator="{ on, attrs }">
            <v-text-field
              v-model="date"
              label="Pick a date"
              prepend-icon="mdi-calendar"
              outlined
              readonly
              hide-details
              dense
              v-bind="attrs"
              v-on="on"
            />
          </template>
          <v-date-picker
            v-model="date"
            no-title
            scrollable
          >
            <v-spacer />
            <v-btn
              text
              color="primary"
              @click="menu = false"
            >
              Cancel
            </v-btn>
            <v-btn
              text
              color="primary"
              @click="$refs.menu.save(date)"
            >
              OK
            </v-btn>
          </v-date-picker>
        </v-menu>
        <v-text-field
          v-model="q"
          label="Part of a player's name"
          outlined
          hide-details
          dense
          class="ml-3"
        />
        <v-btn
          outlined
          class="ml-3"
          :disabled="!date || !q"
          @click="search"
        >
          search
        </v-btn>
      </v-toolbar>
    </v-sheet>
    <v-sheet class="pt-3" max-width="1000">
      <v-list dense>
        <v-list-item-group
          v-model="game"
          color="#0049bd"
        >
          <v-list-item v-for="g in games" :key="g.gid">
            <v-list-item-content>
              {{ g.started }}
            </v-list-item-content>
            <v-list-item-content>
              {{ g.us }}
            </v-list-item-content>
            <v-list-item-content>
              {{ g.them }}
            </v-list-item-content>
            <v-list-item-content>
              {{ g.score }}
            </v-list-item-content>
            <v-list-item-content>
              {{ g.t }}
            </v-list-item-content>
          </v-list-item>
        </v-list-item-group>
      </v-list>
    </v-sheet>
    <v-card v-if="review" tile flat class="py-3" max-width="1000">
      <v-simple-table>
        <template #default>
          <tbody>
            <tr v-for="(hand, i) in review.save.hands" :key="i">
              <td style="border-top: 2px solid black; border-right: 2px solid black; border-left: 2px solid black; padding: 0;">
                <v-simple-table>
                  <template #default>
                    <tbody class="body-1">
                      <tr style="background-color: #c0d4e5;">
                        <td colspan="4" style="border: 0px; padding-left: 9px;">
                          <strong>Hand {{ i + 1 }}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td
                          v-for="(bid, k) in hand.bids"
                          :key="k"
                          style="padding-left: 9px; border: 0px"
                        >
                          {{ nameOf(bid[0]) }}
                          <span v-if="hand.high[0] === bid[0]">
                            <strong>{{ bid[1] }}</strong>
                            on
                            <strong>{{ hand.trump }}</strong>
                          </span>
                          <span v-else>{{ bid[1] }}</span>
                          <div class="d-flex flex-row py-1">
                            <v-img
                              v-for="bone in hand.bones.find(([d]) => d == bid[0])[1]"
                              :key="bone"
                              :src="`/${bone}v.png`"
                              contain
                              max-width="28"
                              class="mr-1"
                            />
                          </div>
                        </td>
                      </tr>
                      <tr v-for="(trick, l) in hand.tricks" :key="l">
                        <td v-for="(bone, m) in trick.bones" :key="m" style="border: 0px; padding-left: 9px;">
                          <div class="d-flex flex-column py-1">
                            <span class="mb-1">
                              {{ nameOf(bone[0]) }}
                              <strong v-if="trick.winner === bone[0]">
                                {{ trick.points }} {{ trick.points === 1 ? 'point' : 'points' }}
                              </strong>
                            </span>
                            <v-img
                              :src="`/${bone[1]}v.png`"
                              contain
                              max-width="28"
                            />
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-left: 9px;" colspan="4">
                          <span v-if="hand.renege">
                            {{ nameOf(hand.renege) }} <strong>reneged</strong>
                          </span>
                          <span v-else>
                            {{ nameOf(hand.high[0]) }}
                            <strong>{{ hand.made ? 'made the bid' : 'got set' }}</strong>
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </template>
                </v-simple-table>
              </td>
            </tr>
          </tbody>
        </template>
      </v-simple-table>
    </v-card>
  </div>
</template>
<script>
export default {
  data () {
    return {
      you: {},
      menu: undefined,
      date: undefined,
      q: undefined,
      games: [],
      game: undefined,
      gamesHeaders: [
        { text: 'Started', value: 'started' },
        { text: 'Us', value: 'us' },
        { text: 'Them', value: 'them' },
        { text: 'Score', value: 'score' },
        { text: 'Tournament', value: 't' },
        { text: '', value: 'data-table-expand' }
      ],
      expanded: [],
      singleExpand: false
    }
  },
  async fetch () {
    const url = `/api/tournaments/me?v=${encodeURIComponent(this.$config.version)}`
    this.you = await this.$axios.$get(url)
  },
  computed: {
    review () {
      return this.games[this.game]?.review
    }
  },
  watch: {
    async game () {
      const g = this.games[this.game]
      if (g && !g.review) {
        const url = `/api/tournaments/stats/game/${g.gid}`
        g.review = await this.$axios.$get(url)
      }
    }
  },
  methods: {
    async search () {
      const url = '/api/tournaments/stats/game/search'
      const { games } = await this.$axios.$get(url, {
        params: {
          d: this.date,
          q: this.q
        }
      })
      const df = new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
      for (const game of games) {
        const players = game.players.split(',')
        game.us = `${players[0]} & ${players[2]}`
        game.them = `${players[1]} & ${players[3]}`
        game.started = df.format(new Date(game.started * 1000))
        game.review = null
      }
      this.games = games
    },
    nameOf (i) {
      if (this.review) {
        return this.review.save.players[i]
      }
    }
  }
}
</script>
