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
      <v-card-actions>
        <div>
          <strong>Rules</strong>
        </div>
        <v-spacer />
        <v-btn
          small
          outlined
          @click="resetRules"
        >
          reset to default
        </v-btn>
      </v-card-actions>
      <v-card-actions class="py-0">
        <v-switch v-model="rules.renege" label="renege" class="mr-2" />
        <v-switch v-model="rules.all_pass" label="reshuffle" class="mr-2" />
        <v-select
          v-model="rules.forced_min_bid"
          :items="bids"
          dense
          hide-details
          outlined
          label="forced bid"
          :disabled="rules.all_pass"
        />
      </v-card-actions>
      <v-card-actions class="py-2">
        <v-select
          v-model="rules.min_bid"
          :items="bids"
          dense
          hide-details
          outlined
          label="min bid"
          class="mr-2"
        />
        <v-select
          v-model="rules.follow_me_doubles"
          :items="doubles"
          multiple
          dense
          hide-details
          outlined
          label="follow-me doubles"
        />
      </v-card-actions>
      <v-card-actions class="py-0">
        <v-switch v-model="rules.plunge_allowed" label="plunge" class="mr-2" />
        <v-select
          v-model="rules.plunge_min_marks"
          :items="marks"
          dense
          hide-details
          outlined
          label="min marks"
          class="mr-2"
          :disabled="!rules.plunge_allowed"
        />
        <v-select
          v-model="rules.plunge_max_marks"
          :items="marks"
          dense
          hide-details
          outlined
          label="max marks"
          :disabled="!rules.plunge_allowed"
        />
      </v-card-actions>
      <v-card-actions class="py-0">
        <v-switch v-model="rules.sevens_allowed" label="sevens" class="mr-2" />
        <v-select
          v-model="rules.nello_allowed"
          :items="nello"
          dense
          hide-details
          outlined
          label="nello"
          class="mr-2"
        />
        <v-select
          v-model="rules.nello_doubles"
          :items="doubles"
          multiple
          dense
          hide-details
          outlined
          label="nello doubles"
          :disabled="rules.nello_allowed === 'NEVER'"
        />
      </v-card-actions>
      <v-card-actions class="py-6">
        <div class="red--text">
          <strong>{{ validate }}</strong>
        </div>
        <v-spacer />
        <v-btn
          outlined
          color="#0049bd"
          :disabled="!!validate"
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
const defaultRules = {
  renege: false,
  all_pass: false,
  min_bid: '30',
  forced_min_bid: '30',
  follow_me_doubles: ['HIGH'],
  plunge_allowed: false,
  plunge_min_marks: 2,
  plunge_max_marks: 2,
  sevens_allowed: false,
  nello_allowed: 'NEVER',
  nello_doubles: ['HIGH_SUIT']
}
export default {
  props: {
    users: {
      type: Array,
      default: null
    }
  },
  data () {
    return {
      bids: ['30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '1-mark'],
      doubles: [
        { value: 'HIGH_SUIT', text: 'high suit' },
        { value: 'LOW_SUIT', text: 'low suit' },
        { value: 'HIGH', text: 'high' },
        { value: 'LOW', text: 'low' }
      ],
      nello: [
        { value: 'NEVER', text: 'never' },
        { value: 'ALWAYS', text: 'always' },
        { value: 'FORCE', text: 'forced' }
      ],
      marks: [1, 2, 3, 4, 5],

      loading: false,
      error: undefined,

      partner: undefined,
      left: undefined,
      right: undefined,

      rules: Object.assign({}, defaultRules)
    }
  },
  computed: {
    validate () {
      if (this.error) {
        return this.error
      }
      const players = [this.left, this.partner, this.right].filter(p => p)
      if (new Set(players).size !== players.length) {
        return 'You can\'t repeat players'
      }
      const { rules } = this
      if (rules.follow_me_doubles.length === 0) {
        return 'Choose something for follow-me doubles'
      }
      if (rules.nello_allowed !== 'NEVER' && rules.nello_doubles.length === 0) {
        return 'Choose something for nello doubles'
      }
      if (rules.plunge_allowed && rules.plunge_max_marks < rules.plunge_min_marks) {
        return 'Check your plunge marks'
      }
      return undefined
    }
  },
  watch: {
  },
  methods: {
    async play () {
      this.loading = true
      try {
        const { rules } = this
        const body = {
          partner: this.partner || null,
          left: this.left || null,
          right: this.right || null,
          rules: {
            renege: rules.renege,
            all_pass: rules.all_pass ? 'SHUFFLE' : 'FORCE',
            min_bid: rules.min_bid,
            forced_min_bid: rules.forced_min_bid,
            follow_me_doubles: rules.follow_me_doubles,
            plunge_allowed: rules.plunge_allowed,
            plunge_min_marks: rules.plunge_min_marks,
            plunge_max_marks: rules.plunge_max_marks,
            sevens_allowed: rules.sevens_allowed,
            nello_allowed: rules.nello_allowed,
            nello_doubles: rules.nello_doubles
          }
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
    },
    resetRules () {
      this.rules = JSON.parse(JSON.stringify(defaultRules))
    }

  }
}
</script>
