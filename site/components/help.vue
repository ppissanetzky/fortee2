<template>
  <div>
    <p>
      If you need help, try asking in the <strong>lobby</strong> first
      or start a private chat with one of our tournament directors.
    </p>
    <p>
      You can also look at our <a href="https://help.fortee2.com" target="_blank">help site</a>.
    </p>
    <p>
      If you'd like to report an issue or make a suggestion, fill in the box
      below with as much detail as possible and then submit it.
      We'll take a look and get back to you.
    </p>
    <v-textarea
      v-model="text"
      rows="5"
      outlined
      hide-details
      :loading="loading"
      :disabled="loading || waiting"
    />
    <div class="d-flex flex-row flex-grow-1 align-center mt-3">
      <span>{{ result }}</span>
      <v-spacer />
      <v-btn
        small
        outlined
        class="ml-3"
        :disabled="!text || waiting"
        :loading="loading"
        @click="submit"
      >
        submit
      </v-btn>
    </div>
    <!-- <div class="d-flex flex-row flex-grow-1 align-center mt-3">
      <span>{{ result }}</span>
    </div> -->
  </div>
</template>
<script>
export default {
  data () {
    return {
      text: undefined,
      loading: false,
      waiting: false,
      result: undefined
    }
  },
  methods: {
    async submit () {
      this.loading = true
      try {
        await this.$axios.$post('/api/tournaments/issue', {
          text: this.text
        })
        this.text = undefined
        this.result = 'Thanks, the issue has been submitted!'
      } catch (error) {
        this.result = 'There was problem submitting the issue, try again later'
      } finally {
        this.loading = false
        this.waiting = true
        setTimeout(() => {
          this.waiting = false
          this.result = undefined
        }, 10000)
      }
    }
  }
}
</script>
