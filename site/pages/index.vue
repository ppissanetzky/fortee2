<template>
  <div>
    <v-sheet class="d-flex justify-space-around mb-6" style="margin-top: 100px;">
      <v-img max-width="400" width="400" src="/logo.png" />
    </v-sheet>
    <v-sheet class="d-flex justify-space-around">
      <v-spacer />
      <v-btn
        outlined
        color="#0049bd"
        class="mr-6"
        height="40"
        @click="$router.push('/main')"
      >
        PLAY
      </v-btn>
      <v-btn
        outlined
        color="#0049bd"
        height="40"
        class="ml-6"
        @click="toSlack()"
      >
        CHAT
      </v-btn>
      <v-spacer />
    </v-sheet>
  </div>
</template>
<script>
export default {
  data () {
    return {}
  },
  methods: {
    toSlack () {
      window.open('https://fortee2.slack.com', '_blank')
    }
  }
}
</script>
