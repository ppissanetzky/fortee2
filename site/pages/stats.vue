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
    <!-- <v-container fluid>
      <v-row>
        <v-col>
        </v-col>
      </v-row>
    </v-container> -->
  </div>
</template>
<script>
export default {
  data () {
    return {
      you: {}
    }
  },
  async fetch () {
    const url = `/api/tournaments/me?v=${encodeURIComponent(this.$config.version)}`
    this.you = await this.$axios.$get(url)
  },
  methods: {
  }
}
</script>
