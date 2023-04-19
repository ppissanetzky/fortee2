<template>
  <v-card>
    <v-toolbar flat color="#8fa5b7">
      <v-toolbar-title class="white--text pl-1">
        <strong>Custom game</strong>
      </v-toolbar-title>
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
          :items="users"
          clearable
          class="mr-2"
        />
        <v-select
          v-model="partner"
          dense
          hide-details
          outlined
          label="partner"
          :items="users"
          clearable
          class="mr-2"
        />
        <v-select
          v-model="right"
          dense
          hide-details
          outlined
          label="right"
          :items="users"
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
</template>
<script>
export default {
  props: {
    users: {
      type: Array,
      default: null
    }
  },
  data () {
    return {
      loading: false,
      error: undefined,

      partner: undefined,
      left: undefined,
      right: undefined,

      rules: undefined
    }
  },
  computed: {
  },
  watch: {
  },
  methods: {
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
          window.open(url, '_self')
        }
      } finally {
        this.loading = false
      }
    }
  }
}
</script>
