<template>
  <div class="ma-3">
    <!-- <v-app-bar dense color="#0049bd" class="white--text">
      <v-toolbar-title>Tournaments</v-toolbar-title>
      <v-spacer />
      <v-menu left bottom>
        <template #activator="{ on, attrs }">
          <v-btn icon v-bind="attrs" v-on="on">
            <v-icon color="white">
              mdi-dots-vertical
            </v-icon>
          </v-btn>
        </template>
        <v-list>
          <v-list-item v-for="n in 5" :key="n" @click="() => {}">
            <v-list-item-title>Option {{ n }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar> -->
    <v-card
      color="#0049bd"
      class="mb-3"
      min-width="375"
    >
      <v-toolbar flat color="#0049bd">
        <v-toolbar-title v-if="you" class="white--text pl-1">
          <strong>Hi, {{ you }}</strong>
        </v-toolbar-title>
        <v-spacer />
        <v-img contain max-width="300" src="/logo.png" />
      </v-toolbar>
      <v-toolbar flat>
        <v-btn outlined height="40">Play with 3 bots</v-btn>
      </v-toolbar>
    </v-card>
    <div>
      <v-card
        v-for="t in today"
        :key="t.id"
        min-width="375"
        color="#c0d4e5"
      >
        <!-- NAME AND START TIME -->
        <v-toolbar flat color="#00000000">
          <v-icon color="black" class="pr-2">mdi-trophy</v-icon>
          <h2>{{ t.name }}</h2>
          <v-spacer />
          <h2>{{ t.startTime }}</h2>
        </v-toolbar>

        <!-- RULES AND INDICATOR -->
        <v-toolbar flat color="#c0d4e5">
          <v-chip v-for="r in t.rules" :key="r" label class="mr-1">
            {{ r }}
          </v-chip>
          <v-spacer />
          <v-chip v-if="t.open" label color="green" class="white--text">
            open until {{ t.closeTime }}
          </v-chip>
          <v-chip v-else-if="t.wts" label color="green" class="white--text">
            starts soon
          </v-chip>
          <v-chip v-else-if="t.playing" label color="green" class="white--text">
            playing now
          </v-chip>
          <v-chip v-else-if="t.later" label>
            opens at {{ t.openTime }}
          </v-chip>
        </v-toolbar>
        <!-- <v-divider /> -->

        <!-- SIGNUP ACTIONS         -->
        <v-toolbar v-if="t.open || t.wts" flat>
          <span v-if="t.signedUp">
            You are <strong>signed up</strong>
            <span v-if="t.partner">
              with <strong>{{ nameOf(t.partner) }}</strong>
            </span>
          </span>
          <span v-else>
            You are <strong>not signed up</strong>
          </span>
          <v-spacer />
        </v-toolbar>
        <v-toolbar v-if="t.open" flat>
          <!-- TO SIGN UP -->
          <v-select
            v-if="t.choosePartner"
            v-model="t.newPartner"
            dense
            hide-details
            outlined
            label="PARTNER"
            class="mr-2"
            :items="users"
            clearable
          />
          <v-btn
            outlined
            color="green"
            class="mr-2"
            height="40"
            :loading="loading"
            :disabled="t.signedUp && t.partner === t.newPartner"
            @click="signUp(t)"
          >
            sign up
          </v-btn>
          <v-btn
            outlined
            color="red"
            height="40"
            class="mr-2"
            :loading="loading"
            :disabled="!t.signedUp"
            @click="dropOut(t.id)"
          >
            drop out
          </v-btn>
          <v-spacer />
          <v-spacer />
          <span>
            {{ t.count || 'No one' }} signed up
          </span>
        </v-toolbar>
        <v-toolbar v-if="t.table" flat>
          <span>
            Your partner is <strong>{{ partner(t) }}</strong>
            and you're playing against
            <strong>{{ others(t)[0] }}</strong> and
            <strong>{{ others(t)[1] }}</strong>
          </span>
        </v-toolbar>
        <v-toolbar v-if="t.table" flat>
          <v-btn
            outlined
            color="green"
            class="mr-2"
            height="40"
            @click="goToTable(t.table.url)"
          >
            go to your table
          </v-btn>
        </v-toolbar>
        <v-sheet v-if="t.open || t.table" height="12" />
      </v-card>
    </div>
  </div>
</template>
<script>
export default {
  data () {
    return {
      you: undefined,
      today: [],
      users: [],
      loading: false
    }
  },
  async fetch () {
    const { users, tournaments, you } = await this.$axios.$get('/api/tournaments')
    this.users = Object.keys(users).map(key => ({ value: key, text: users[key] }))
    for (const t of tournaments) {
      t.newPartner = t.partner
    }
    this.today = tournaments
    this.you = you
  },
  methods: {
    nameOf (id) {
      const item = this.users.find(({ value }) => value === id)
      return item?.text
    },
    async signUp (t) {
      const { id, newPartner } = t
      this.loading = true
      const url = `/api/tournaments/signup/${id}/${newPartner || 'null'}`
      const { error, tournament } = await this.$axios.$get(url)
      if (error) {
        //
      } else {
        tournament.newPartner = tournament.partner
        const i = this.today.indexOf(t => t.id === id)
        this.today.splice(i, 1, tournament)
      }
      this.loading = false
    },
    async dropOut (id) {
      this.loading = true
      const url = `/api/tournaments/dropout/${id}`
      const { error, tournament } = await this.$axios.$get(url)
      if (error) {
        //
      } else {
        tournament.newPartner = tournament.partner
        const i = this.today.indexOf(t => t.id === id)
        this.today.splice(i, 1, tournament)
      }
      this.loading = false
    },
    goToTable (url) {
      window.open(url, '_blank')
    },
    partner (t) {
      const { table } = t
      if (table && this.you) {
        const i = table.players.indexOf(this.you)
        return table.players[[2, 3, 0, 1][i]]
      }
    },
    others (t) {
      const { table } = t
      if (table) {
        const us = [this.you, this.partner(t)]
        return table.players.filter(name => !us.includes(name))
      }
      return []
    },
    connected (t, name) {
      const { table } = t
      return table && table.connected.includes(name)
    }
  }
}
</script>
