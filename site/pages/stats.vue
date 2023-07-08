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
    <v-sheet max-width="1000">
      <v-toolbar flat>
        <v-select
          v-model="statType"
          :items="statList"
          hide-details
          dense
          outlined
          label="Stat"
          class="mr-3"
        />
        <v-select
          v-model="statSince"
          :items="['1 day', '1 week', '1 month', '1 year']"
          hide-details
          dense
          outlined
          label="Duration"
        />
      </v-toolbar>
      <span class="mx-7"><i>{{ statDesc }}</i></span>
      <div>
        <v-sheet>
          <v-data-table
            :items="stats"
            :headers="statsHeaders"
          />
        </v-sheet>
      </div>
    </v-sheet>
  </div>
</template>
<script>
export default {
  data () {
    return {
      you: {},
      statType: undefined,
      statDesc: undefined,
      statList: [],
      statSince: '1 week',
      stats: [],
      statsHeaders: []
    }
  },
  async fetch () {
    const url = `/api/tournaments/me?v=${encodeURIComponent(this.$config.version)}`
    this.you = await this.$axios.$get(url)
    this.statList = await this.$axios.$get('/api/tournaments/stats/public/list')
  },
  watch: {
    async statType () {
      await this.loadStats()
    },
    async statSince () {
      await this.loadStats()
    }
  },
  methods: {
    async loadStats () {
      if (!this.statType) {
        return
      }
      const url = `/api/tournaments/stats/public/${this.statType}`
      const { headers, desc, rows } = await this.$axios.$get(url, {
        params: {
          s: this.statSince
        }
      })
      this.statsHeaders = headers
      this.stats = rows
      this.statDesc = desc
    }
  }
}
</script>
