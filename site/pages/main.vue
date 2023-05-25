<template>
  <div class="ma-3">
    <!-- ************************************************************* -->
    <!-- DIALOG TO REFRESH ON VERSION MISMATCH -->
    <!-- ************************************************************* -->
    <v-dialog v-model="refreshDialog" persistent max-width="300">
      <v-card>
        <v-card-title>
          <p class="body-1">
            There is a new version available!
          </p>
        </v-card-title>
        <v-card-actions>
          <v-spacer />
          <v-btn outlined small @click="reload">
            refresh
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ************************************************************* -->
    <!-- THE DIALOG TO START A GAME -->
    <!-- ************************************************************* -->

    <v-dialog v-model="dialog" max-width="800">
      <v-card>
        <v-toolbar flat color="#8fa5b7">
          <v-toolbar-title class="white--text pl-1">
            <strong>Start a game</strong>
          </v-toolbar-title>
          <v-spacer />
          <v-btn small icon color="white" class="mr-1" @click="dialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <div class="px-2">
          <div class="pa-3">
            Choose other players to invite, or leave them blank to play with bots
          </div>
          <v-card-actions>
            <v-select
              v-model="left"
              dense
              hide-details
              outlined
              label="left"
              :items="otherUsers"
              clearable
              class="mr-2"
            />
            <v-select
              v-model="partner"
              dense
              hide-details
              outlined
              label="partner"
              :items="otherUsers"
              clearable
              class="mr-2"
            />
            <v-select
              v-model="right"
              dense
              hide-details
              outlined
              label="right"
              :items="otherUsers"
              clearable
            />
          </v-card-actions>
          <Rules v-model="rules" />
          <v-card-actions class="py-6">
            <div class="red--text">
              <strong>{{ error }}</strong>
            </div>
            <v-spacer />
            <v-btn
              outlined
              color="#0049bd"
              :disabled="!!error"
              :loading="loading"
              @click="play"
            >
              play
            </v-btn>
          </v-card-actions>
        </div>
      </v-card>
    </v-dialog>

    <!-- ************************************************************* -->
    <!-- TOOLBAR -->
    <!-- ************************************************************* -->
    <v-toolbar flat color="#0049bd" max-width="1000">
      <v-img contain max-width="375" src="/logo-tight.png" />
      <span class="caption white--text ml-2 mb-1 align-self-end">
        <strong>{{ $config.version }}</strong>
      </span>
      <!-- <v-btn @click="screenShot">ss</v-btn> -->
      <v-spacer />
      <v-toolbar-title v-if="you.name" class="white--text">
        <strong>Hi, {{ myName }}</strong>
      </v-toolbar-title>
      <!-- ************************************************************* -->
      <!-- ACCOUNT MENU -->
      <!-- ************************************************************* -->
      <v-menu offset-y>
        <template #activator="{ on, attrs }">
          <v-btn icon color="white" v-bind="attrs" v-on="on">
            <v-icon>mdi-account</v-icon>
          </v-btn>
        </template>
        <v-card tile>
          <v-card-text>
            <!-- <v-img :src="you.prefs?.picture" contain aspect-ratio="1" max-width="96" /> -->
            <div>
              You are signed in as <strong>{{ you.name }}</strong><br>
              <span class="blue--text">{{ you.email }}</span><br>
              <span>You are a <strong>{{ you.type }}</strong> user</span><br>
              <div v-if="you.roles?.length" class="mt-3">
                <v-chip v-if="you.roles?.includes('admin')" small label>
                  admin
                </v-chip>
                <v-chip v-if="you.roles?.includes('td')" small label>
                  TD
                </v-chip>
              </div>
            </div>
          </v-card-text>
          <v-card-actions>
            <v-btn text @click="signOut">
              sign out
            </v-btn>
          </v-card-actions>
          <v-divider />
          <v-card-actions>
            <v-btn
              v-if="you?.roles?.includes('td')"
              text
              @click="openUrl('/td')"
            >
              open TD page
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-menu>
      <!-- ************************************************************* -->
      <!-- STATS MENU -->
      <!-- ************************************************************* -->
      <v-menu offset-y>
        <template #activator="{ on, attrs }">
          <v-btn icon color="white" v-bind="attrs" v-on="on">
            <v-icon>mdi-chart-bar</v-icon>
          </v-btn>
        </template>
        <v-card tile class="pa-1">
          <v-list dense>
            <v-list-item-group color="#0049bd">
              <v-list-item @click="openUrl('/game-review')">
                <v-list-item-content>
                  Game Review
                </v-list-item-content>
              </v-list-item>
            </v-list-item-group>
          </v-list>
        </v-card>
      </v-menu>
    </v-toolbar>

    <div class="d-flex flex-row">
      <!-- ************************************************************* -->
      <!-- LEFT HAND BAR -->
      <!-- ************************************************************* -->

      <div class="d-flex align-stretch my-3 mr-3">
        <v-sheet min-width="256" width="256" class="d-flex flex-column">
          <!-- ************************************************************* -->
          <!-- START A GAME OR HOSTING -->
          <!-- ************************************************************* -->
          <v-card v-if="table.status === 'hosting'" tile class="pa-3 mb-3">
            <div class="d-flex flex-column">
              <p>
                You started a game {{ tableWith() }}
              </p>
              <div class="d-flex flex-row">
                <v-spacer />
                <v-btn small outlined class="red--text" @click="decline">
                  <v-icon left>
                    mdi-close-circle-outline
                  </v-icon>
                  close
                </v-btn>
              </div>
            </div>
          </v-card>
          <v-card v-else tile class="pa-3 mb-3">
            <div class="d-flex flex-row">
              <div class="mr-3 align-self-center">
                <strong>Start a game</strong>
              </div>
              <v-spacer />
              <v-btn small outlined class="align-self-center" @click="dialog = true">
                <v-icon left>
                  mdi-play
                </v-icon>
                play
              </v-btn>
            </div>
          </v-card>

          <!-- ************************************************************* -->
          <!-- INVITATION -->
          <!-- ************************************************************* -->
          <v-card v-if="table.status === 'invited'" tile class="pa-3 mb-3">
            <div class="d-flex flex-column">
              <p class="body-1">
                You have been <strong>invited</strong> to play a game {{ tableWith() }}
              </p>
              <div class="d-flex flex-row">
                <v-spacer />
                <v-btn small outlined class="mr-3 green--text" @click="openUrl(table.url)">
                  <v-icon left>
                    mdi-play
                  </v-icon>
                  play
                </v-btn>
                <v-btn small outlined class="red--text" @click="decline">
                  <v-icon left>
                    mdi-cancel
                  </v-icon>
                  decline
                </v-btn>
              </div>
            </div>
          </v-card>

          <!-- ************************************************************* -->
          <!-- GUEST MESSAGE -->
          <!-- ************************************************************* -->
          <v-card v-if="guest" tile class="pa-3 mb-3">
            <div class="d-flex flex-column">
              <p class="body-1">
                <strong>Welcome to fortee2, {{ myName }}!</strong>
              </p>
              <p class="body-1">
                Right now, you're a <strong>guest</strong>,
                but once you become a member, you'll be able to play in our tournaments
              </p>
            </div>
          </v-card>

          <!-- ************************************************************* -->
          <!-- ALL TOURNAMENT STUFF -->
          <!-- ************************************************************* -->
          <div>
            <!-- ************************************************************* -->
            <!-- TOURNAMENTS -->
            <!-- ************************************************************* -->
            <v-card v-for="t in sortedTs()" :key="t.id" tile class="mb-3">
              <v-sheet
                flat
                :color="tournamentColor(t) "
                height="30"
                class="d-flex flex-row white--text overline pa-0 py-1 pl-3 ma-0 align-center"
              >
                <span v-if="t.open">open for {{ ticks[t.id]?.close }}</span>
                <span v-else-if="t.wts">starts in {{ ticks[t.id]?.start }}</span>
                <span v-else-if="t.playing">playing</span>
                <span v-else-if="t.done">finished</span>
                <span v-else>starts at {{ t.startTime }}</span>
                <v-spacer />
                <v-btn
                  v-if="t.playing"
                  text
                  small
                  color="white"
                  @click="openUrl(`/track?t=${t.id}`)"
                >
                  track
                  <v-icon small right class="ma-0">
                    mdi-open-in-new
                  </v-icon>
                </v-btn>
                <v-menu offset-x>
                  <template #activator="{ on, attrs }">
                    <v-btn text small color="white" v-bind="attrs" v-on="on">
                      rules
                      <v-icon x-small right class="ma-0">
                        mdi-chevron-right
                      </v-icon>
                    </v-btn>
                  </template>
                  <human-rules v-model="t.fullRules" />
                </v-menu>
              </v-sheet>
              <div class="pa-3">
                <!-- ************************************************************* -->
                <!-- OPEN -->
                <!-- ************************************************************* -->
                <div v-if="t.open" class="d-flex flex-column body-1">
                  <p>
                    The <strong>{{ t.name }}</strong> tournament starting at {{ t.startTime }} is open for
                    <v-chip label small :color="t.signedUp ? 'green' : 'red'" class="white--text">
                      <strong>{{ ticks[t.id]?.close }}</strong>
                    </v-chip>
                  </p>
                  <p v-if="guest">
                    As a <strong>guest</strong>, you cannot sign up for tournaments
                  </p>
                  <div v-else>
                    <p v-if="t.signedUp">
                      You are <strong>signed up</strong>
                      <span v-if="t.partner">
                        with <strong>{{ nameOf(t.partner) }}</strong>
                      </span>
                      <span v-else-if="t.choosePartner">
                        with <strong>no partner</strong>
                      </span>
                    </p>
                    <p v-else>
                      You are <strong>not signed up</strong>
                    </p>
                    <div v-if="partnerMismatch(t)" class="mb-5">
                      <span>
                        <strong>{{ partnerMismatch(t) }}</strong> signed up with you as partner,
                        do you want to sign up with {{ partnerMismatch(t) }}?
                        <v-btn
                          x-small
                          outlined
                          color="black"
                          :loading="loading"
                          @click="signUp(t, partnerMismatch(t))"
                        >
                          yes
                        </v-btn>
                      </span>
                    </div>
                    <div v-if="t.choosePartner" class="mb-3">
                      <v-select
                        v-model="t.newPartner"
                        dense
                        outlined
                        hide-details
                        label="choose your partner"
                        :items="otherUsers"
                        clearable
                      />
                    </div>
                    <div class="d-flex flex-row mb-1">
                      <v-btn
                        class="green--text"
                        small
                        outlined
                        :loading="loading"
                        :disabled="t.signedUp && t.partner === t.newPartner"
                        @click="signUp(t)"
                      >
                        <v-icon left>
                          mdi-account-check
                        </v-icon>
                        sign up
                      </v-btn>
                      <v-spacer />
                      <v-btn
                        small
                        outlined
                        class="red--text"
                        :loading="loading"
                        :disabled="!t.signedUp"
                        @click="dropOut(t.id)"
                      >
                        <v-icon left>
                          mdi-account-off
                        </v-icon>
                        drop out
                      </v-btn>
                    </div>
                  </div>
                  <p v-if="t.count === 0" class="mt-4">
                    No one signed up yet
                  </p>
                  <v-expansion-panels v-else flat>
                    <v-expansion-panel>
                      <v-expansion-panel-header class="body-1 px-0">
                        {{ t.count }} signed up
                        <span v-if="t.count < 8">
                          , need {{ 8 - t.count }} more
                        </span>
                      </v-expansion-panel-header>
                      <v-expansion-panel-content class="mx-0">
                        <div class="mb-3">
                          <v-chip
                            v-for="s in signupsFor(t).sort()"
                            :key="s"
                            label
                            small
                            class="mr-1 mb-1 white--text"
                            color="#0049bd"
                          >
                            <strong>{{ s }}</strong>
                          </v-chip>
                        </div>
                      </v-expansion-panel-content>
                    </v-expansion-panel>
                  </v-expansion-panels>
                </div>
                <!-- ************************************************************* -->
                <!-- WAITING TO START -->
                <!-- ************************************************************* -->
                <div v-else-if="t.wts" class="d-flex flex-column body-1">
                  <p>
                    The <strong>{{ t.name }}</strong> tournament starts in
                    <v-chip label small :color="t.signedUp ? 'green' : 'red'" class="white--text">
                      <strong>{{ ticks[t.id]?.start }}</strong>
                    </v-chip>
                  </p>
                  <div v-if="!guest">
                    <p v-if="t.signedUp">
                      You <strong>signed up</strong>
                      - wait for your first game to start
                    </p>
                    <p v-else>
                      You did not sign up
                    </p>
                  </div>
                </div>

                <!-- ************************************************************* -->
                <!-- PLAYING -->
                <!-- ************************************************************* -->
                <div v-else-if="t.playing" class="d-flex flex-column body-1">
                  <p>
                    The <strong>{{ t.name }}</strong> tournament is playing now
                  </p>
                  <div v-if="!guest && t.isOn">
                    <p v-if="!t.signedUp">
                      You did not sign up
                    </p>
                    <p v-else-if="!t.inTourney">
                      Unfortunately, <strong>you were dropped</strong>
                      because an odd number of people signed up
                    </p>
                    <p v-else-if="!t.stillPlaying">
                      You were <strong>eliminated</strong>, better luck next time
                    </p>
                    <div v-else-if="t.hasRoom">
                      <p>
                        Your table is ready and your partner is <strong>{{ t.actualPartner }}</strong>
                      </p>
                      <div class="d-flex flex-row">
                        <v-btn
                          small
                          outlined
                          class="green--text"
                          @click="openUrl(t.url)"
                        >
                          <v-icon left>
                            mdi-account-arrow-right
                          </v-icon>
                          go to your table
                        </v-btn>
                        <v-icon class="ml-3" :color="blink ? 'green' : '#00000000'">
                          mdi-arrow-left-circle
                        </v-icon>
                      </div>
                    </div>
                    <p v-else-if="t.stillPlaying">
                      Please wait for your next table to be ready
                    </p>
                  </div>
                  <!-- ROW OF TABLE-STATUS SQUARES -->
                  <div v-if="tablesFor(t).length" class="d-flex flex-column mt-3">
                    <span class="caption mb-1">Table status</span>
                    <div class="d-flex flex-row">
                      <v-sheet
                        v-for="g in tablesFor(t)"
                        :key="g.id"
                        width="32"
                        height="20"
                        class="mr-1 mb-1"
                        :color="gameColor(g)"
                        @click="g.room && !g.finished? openUrl(`/play?watch=${g.room.token}`) : undefined"
                      >
                        <div class="caption white--text text-center">
                          <strong>{{ gameStatusLetter(g) }}</strong>
                        </div>
                      </v-sheet>
                    </div>
                  </div>
                </div>

                <!-- ************************************************************* -->
                <!-- FINISHED -->
                <!-- ************************************************************* -->
                <div v-else-if="t.done" class="d-flex flex-column body-1">
                  <p v-if="t.winners">
                    Congratulations to <strong>{{ t.winners[0] }}</strong> and <strong>{{ t.winners[1] }}</strong>
                    for winning the <strong>{{ t.name }}</strong>
                    tournament at {{ t.startTime }}
                  </p>
                  <p v-else>
                    Unfortunately, something went wrong with the <strong>{{ t.name }}</strong>
                    tournament at {{ t.startTime }}
                  </p>
                </div>

                <!-- ************************************************************* -->
                <!-- LATER -->
                <!-- ************************************************************* -->
                <div v-else-if="t.later" class="d-flex flex-column body-1">
                  <p>
                    <strong>{{ t.name }}</strong> opens for signup at <strong>{{ t.openTime }}</strong>
                  </p>
                </div>
              </div>
            </v-card>
          </div>
          <v-card tile class="mb-3">
            <div class="pa-0">
              <v-sheet color="secondary" class="px-3 mb-1 overline white--text">
                tournament schedule
              </v-sheet>
              <v-tabs
                v-model="tab"
                show-arrows
                center-active
              >
                <v-tab v-for="t in today.filter(({ later }) => later)" :key="t.id">
                  {{ t.startTime }}
                </v-tab>
              </v-tabs>
              <v-tabs-items v-model="tab">
                <v-tab-item v-for="t in today.filter(({ later }) => later)" :key="t.id" class="pa-3">
                  <p class="mt-2">
                    <strong>{{ t.name }}</strong> opens for signup at <strong>{{ t.openTime }}</strong>
                  </p>
                  <v-menu offset-x>
                    <template #activator="{ on, attrs }">
                      <v-btn outlined small color="secondary" v-bind="attrs" v-on="on">
                        rules
                        <v-icon x-small right class="ma-0">
                          mdi-chevron-right
                        </v-icon>
                      </v-btn>
                    </template>
                    <human-rules v-model="t.fullRules" />
                  </v-menu>
                </v-tab-item>
              </v-tabs-items>
            </div>
          </v-card>

          <!-- ************************************************************* -->
          <!-- DONATION MESSAGE -->
          <!-- ************************************************************* -->
          <v-card v-if="!guest && showDonation" tile class="mb-3">
            <v-sheet
              flat
              color="#c0d4e5"
              height="30"
              class="d-flex flex-row overline pa-0 py-1 pl-3 ma-0 align-center"
            >
              <span>thank you</span>
            </v-sheet>
            <div class="d-flex flex-column pa-3">
              <p class="body-1">
                Although fortee2 is free to play, it costs <strong>$30 a month</strong> to keep it running.
                Consider <a href="https://www.paypal.com/donate/?business=HS465FN6SX8XG&no_recurring=0&item_name=fortee2.com+maintenance+costs.+&currency_code=USD" target="_blank">
                  making a donation</a>
                to help cover the cost.
              </p>
            </div>
          </v-card>
        </v-sheet>
      </div>
      <div class="d-flex">
        <!-- LOBBY -->
        <v-card tile class="mt-3 pa-3 pb-4" width="732" height="666">
          <v-row class="pa-0 pb-3">
            <v-col class="pl-3 pr-0">
              <div class="d-flex pb-3 flex-column">
                <v-card
                  id="chat-box"
                  flat
                  tile
                  height="596"
                  class="overflow-y-auto"
                >
                  <!-- MAYBE A WAY TO SHOW IMPORTANT NOTIFICATIONS -->
                  <!-- <v-menu v-model="testing" bottom offset-y :close-on-click="false" :close-on-content-click="false">
                    <template #activator><div></div></template>
                    <v-card><v-card-title>Hi there</v-card-title></v-card>
                  </v-menu> -->

                  <div v-for="m in messages" :key="m.id" class="mb-1">
                    <div>
                      <strong>{{ m.name }}</strong>
                      <v-chip v-if="m.title" small label color="blue-grey lighten-5" class="ml-1 pa-1">
                        <strong style="color: #78909C;">{{ m.title }}</strong>
                      </v-chip>
                      <span class="ml-1 caption grey--text">{{ formatTime(m.t) }}</span>
                    </div>
                    <div>{{ m.text }}</div>
                  </div>
                </v-card>
              </div>
              <v-form @submit.prevent="() => void 0" @submit="chat">
                <v-text-field
                  v-model="message"
                  dense
                  clearable
                  placeholder="send a message..."
                  hide-details
                  append-icon="mdi-send"
                  style="background-color: white; border-radius: 0; border-color: red;"
                  @click:append="chat"
                />
              </v-form>
            </v-col>
            <v-col cols="auto" class="d-flex flex-row">
              <v-divider vertical class="mx-3" />
              <div class="d-flex flex-column fill-height">
                <v-card
                  flat
                  tile
                  height="596"
                  class="d-flex overflow-y-auto"
                >
                  <v-card-text class="py-0 px-0">
                    <div v-if="online('td').length" class="mb-2">
                      <h3>TDs</h3><v-divider class="mb-1" />
                      <div v-for="u in online('td')" :key="u.id">
                        {{ u.text }}
                      </div>
                    </div>
                    <div v-if="online('standard').length" class="mb-2">
                      <h3>Members</h3><v-divider class="mb-1" />
                      <div v-for="u in online('standard')" :key="u.id">
                        {{ u.text }}
                      </div>
                    </div>
                    <div v-if="online('guest').length" class="mb-2">
                      <h3>Guests</h3><v-divider class="mb-1" />
                      <div v-for="u in online('guest')" :key="u.id">
                        {{ u.text }}
                      </div>
                    </div>
                  </v-card-text>
                </v-card>
                <div>
                  <div class="caption mt-6">
                    {{ users.length }} online
                  </div>
                </div>
              </div>
            </v-col>
          </v-row>
        </v-card>
        <!-- THE TOURNAMENT TRACKER -->
        <!-- <v-card v-if="(t.playing || t.done) && t.games" flat tile class="mt-3 pb-1">
          <v-sheet class="d-flex flex-column pt-3">
            <v-row class="align-self-center">
              <v-col v-for="(round, n) in t.games" :key="n" cols="auto">
                <div>
                  <h5 class="text-center">
                    ROUND {{ n + 1 }}
                  </h5>
                </div>
                <div class="d-flex fill-height flex-column justify-space-around">
                  <div v-for="game in round" :key="game.id">
                    <v-card
                      flat
                      tile
                      class="ml-3 my-1"
                      outlined
                      color="#8fa5b7"
                    >
                      <v-toolbar
                        flat
                        height="28"
                        :color="gameColor(game)"
                        class="white--text caption"
                      >
                        <span>
                          {{ game.id }}
                        </span>
                        <v-btn
                          v-if="game.room && !game.finished"
                          small
                          text
                          color="white"
                          @click="openUrl(`/play?watch=${game.room.token}`)"
                        >
                          watch
                        </v-btn>
                        <v-spacer />
                        <span v-if="game.finished">finished</span>
                        <div v-else-if="game.room">
                          <span v-if="game.room.state === 'waiting'">waiting for players</span>
                          <span v-else-if="game.room.state === 'playing' && game.room.idle">stuck</span>
                          <span v-else-if="game.room.state === 'playing'">playing</span>
                          <span v-else-if="game.room.state === 'paused'">paused</span>
                          <span v-else>expired</span>
                        </div>
                        <span v-else>waiting</span>
                      </v-toolbar>
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
                            <div v-else>
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
              </v-col>
            </v-row>
          </v-sheet>
        </v-card> -->
      </div>
    </div>
  </div>
</template>
<script>
function format (t) {
  const ms = t - Date.now()
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
const dtFormat = new Intl.DateTimeFormat(undefined, {
  timeStyle: 'short'
})
const loaded = Date.now()

export default {
  data () {
    return {
      you: {},
      today: [],
      users: [],
      table: {},
      messages: [],
      message: undefined,
      // For the play dialog
      dialog: false,
      error: undefined,
      partner: undefined,
      left: undefined,
      right: undefined,
      rules: undefined,
      // Other
      loading: false,
      ws: undefined,
      interval: undefined,
      ticks: {},
      blink: false,
      reconnectS: 1,
      refreshDialog: false,
      showDonation: Math.random() < 0.50,
      testing: true,
      tab: undefined
    }
  },
  async fetch () {
    try {
      const url = `/api/tournaments/me?v=${encodeURIComponent(this.$config.version)}`
      this.you = await this.$axios.$get(url)
      this.connect()
      this.startPings()
      this.tick()
    } catch (error) {
      if (error?.response?.status === 401) {
        return window.open('/', '_top')
      }
      throw error
    }
  },
  computed: {
    myName () {
      return this.you.displayName || this.you.name
    },
    otherUsers () {
      return this.users.filter(({ value }) => value !== this.you.id)
    },
    guest () {
      return this.you?.type === 'guest'
    }
  },
  methods: {
    signOut () {
      window.open('/api/signout', '_top')
    },
    startPings () {
      // send a ping message (not a WS ping)
      setInterval(() => {
        if (this.ws) {
          this.ws.send(JSON.stringify({
            ping: `c:${this.$config.version}:${new Date().toISOString()}`
          }))
        }
      }, 3 * 60000)
    },
    connect () {
      const version = encodeURIComponent(this.$config.version)
      let url = `wss://${window.location.hostname}/api/tournaments/tws?v=${version}`
      if (process.env.NUXT_ENV_DEV) {
        url = `ws://${window.location.hostname}:4004/api/tournaments/tws?v=${version}`
      }
      const ws = new WebSocket(url)
      ws.onopen = () => {
        this.reconnectS = 1
        this.ws = ws
        this.ws.onmessage = (event) => {
          const { type, message } = JSON.parse(event.data)
          if (type) {
            this.onMessage(type, message)
          }
        }
        this.ws.send(JSON.stringify({
          type: 'info',
          message: {
            loaded,
            screenW: window.screen.width,
            screenH: window.screen.height,
            innerW: window.innerWidth,
            innerH: window.innerHeight
          }
        }))
      }
      ws.onclose = (event) => {
        this.ws = undefined
        if (event.code === 4000) {
          return window.open('/', '_top')
        } else if (event.code === 4001) {
          return
        }
        setTimeout(() => this.connect(), this.reconnectS * 1000)
        this.reconnectS = Math.min(this.reconnectS * 2, 20)
      }
    },
    onMessage (type, message) {
      switch (type) {
        case 'mismatch':
          if (this.ws) {
            this.ws.close(4001)
            this.ws = undefined
          }
          this.refreshDialog = true
          break
        case 'you':
          this.you = message
          break
        case 'online':
          this.users = message
          break
        case 'tournaments':
          this.today = message
          break
        case 'tournament':
          this.updateTournament(message)
          break
        case 'table':
          this.table = message
          break
        case 'user':
          this.updateStatus(message)
          break
        case 'game':
          this.updateGame(message)
          break
        case 'chat':
          this.messages.push(message)
          this.scrollChat()
          break
        case 'chatHistory':
          this.messages = message
          this.scrollChat()
          break
      }
    },
    nameOf (id) {
      const item = this.users.find(({ value }) => value === id)
      return item?.text
    },
    idOf (name) {
      const item = this.users.find(({ text }) => text === name)
      return item?.value
    },
    tableWith () {
      const w = this.table.with
      if (!w) {
        return ''
      } else if (w.length === 0) {
        return 'with bots'
      }
      return w.reduce((result, { name }, index) => {
        if (index === 0) {
          result += name
        } else if (index === w.length - 1) {
          result += ' and ' + name
        } else {
          result += ', ' + name
        }
        return result
      }, 'with ')
    },
    signupsFor (t) {
      return t.signups.map(([s, p]) => `${s}${p ? ' & ' + p : ''}`)
    },
    partnerMismatch (t) {
      if (t.open && t.choosePartner) {
        const name = this.myName
        if (t.signups.some(([s, p]) => s === name && p)) {
          return
        }
        // The first signup with me as a partner
        const theirs = t.signups.find(([s, p]) => p === name)
        if (theirs) {
          // The name of the person that signed up with me
          return theirs[0]
        }
      }
    },
    online (type) {
      return this.users.filter(user => user.type === type)
    },
    async signUp (t, partnerName) {
      const { id } = t
      this.loading = true
      let { newPartner } = t
      if (partnerName) {
        newPartner = this.idOf(partnerName)
      }
      const url = `/api/tournaments/signup/${id}/${newPartner || 'null'}`
      const { error } = await this.$axios.$get(url)
      if (error) {
        //
      }
      this.loading = false
    },
    async dropOut (id) {
      this.loading = true
      const url = `/api/tournaments/dropout/${id}`
      const { error } = await this.$axios.$get(url)
      if (error) {
        //
      }
      this.loading = false
    },
    async play () {
      this.loading = true
      try {
        const body = {
          partner: this.partner || null,
          left: this.left || null,
          right: this.right || null,
          rules: this.rules
        }
        const { url, error } = await this.$axios
          .$post('/api/tournaments/start-game', body)
        if (error) {
          this.error = error
          setTimeout(() => {
            this.error = undefined
          }, 5000)
        } else if (url) {
          this.dialog = false
          window.open(url, '_blank')
        }
      } finally {
        this.loading = false
      }
    },
    decline () {
      if (this.table.token) {
        const url = `/api/tournaments/decline/${this.table.token}`
        this.$axios.$get(url)
      }
    },
    updateTournament (tournament) {
      if (!tournament) {
        return
      }
      const i = this.today.findIndex(t => t.id === tournament.id)
      if (i < 0) {
        return
      }
      tournament.newPartner = tournament.partner
      this.today.splice(i, 1, tournament)
    },
    updateStatus (status) {
      const t = this.today.find(({ id }) => id === status.id)
      if (t) {
        this.updateTournament({ ...t, ...status })
      }
    },
    updateGame (game) {
      const t = this.today.find(({ id }) => id === game.tid)
      if (!t) {
        return
      }
      if (!t.games) {
        return
      }
      const round = t.games[game.round - 1]
      if (!round) {
        return
      }
      const index = round.findIndex(other => other.id === game.id)
      if (index >= 0) {
        round.splice(index, 1, game)
      }
    },
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
    gameStatusLetter (game) {
      if (!game.finished && game.room) {
        const { state, idle } = game.room
        if (state === 'paused') {
          return 'D'
        }
        if (state === 'waiting') {
          return 'W'
        }
        if (state === 'playing' && idle) {
          return 'S'
        }
      }
      if (game.room) {
        return ['us', 'them']
          .map(team => game.disq[team] ? 'F' : game.room[team].marks)
          .join('-')
      }
      return ''
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
        return 'green'
      }
      if (t.open) {
        return 'green'
      }
      if (t.later) {
        return 'secondary'
      }
      return '#0049bd'
    },
    connected (t, name) {
      return false
    },
    tick () {
      this.blink = !this.blink
      if (!this.interval) {
        this.interval = setInterval(() => this.tick(), 1000)
      }
      this.ticks = this.today.reduce((result, t) => {
        result[t.id] = {
          close: format(t.utcCloseTime),
          start: format(t.utcStartTime)
        }
        return result
      }, {})
    },
    formatTime (t) {
      return dtFormat.format(new Date(t)).toLocaleLowerCase()
    },
    chat () {
      const { message, ws } = this
      if (message && ws) {
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
    reload () {
      window.location.reload()
    },
    sortedTs () {
      return this.today.filter(({ canceled, later }) => !canceled && !later).map((t) => {
        // Whether the user is in the tourney.
        // When the tourney is playing, true if the user signed up and didn't
        // get dropped. Otherwise, true if the user signed up
        const inIt = t.inTourney || t.signedUp

        let order = Infinity

        if (inIt && (t.playing || t.done || t.wts)) {
          order = 0
        } else if (t.open) {
          order = 1
        } else if (t.later) {
          order = 2
        } else {
          order = 3
        }

        return { t, order }
      }).sort((a, b) => a.order - b.order).map(({ t }) => t)
    }
    // async screenShot () {
    //   try {
    //     const canvas = document.createElement('canvas')
    //     const context = canvas.getContext('2d')
    //     const video = document.createElement('video')
    //     const captureStream = await navigator.mediaDevices.getDisplayMedia()
    //     video.srcObject = captureStream
    //     context.drawImage(video, 0, 0, window.width, window.height)
    //     const data = canvas.toDataURL('image/png')
    //     captureStream.getTracks().forEach(track => track.stop())
    //     this.$axios.$post('/api/tournaments/ss', { data })
    //   } catch (err) {
    //     console.error('Error ', err)
    //   }
    // }
  }
}
</script>
