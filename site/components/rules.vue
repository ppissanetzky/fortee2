<template>
  <v-card flat class="pa-0">
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
    <v-card-actions>
      <v-switch v-model="rules.renege" label="renege" class="mr-2" />
      <v-switch v-model="reshuffle" label="reshuffle" class="mr-2" />
      <v-select
        v-model="rules.forced_min_bid"
        :items="bids"
        dense
        hide-details
        outlined
        label="forced bid"
        :disabled="reshuffle"
      />
    </v-card-actions>
    <v-card-actions>
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
    <v-card-actions>
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
    <v-card-actions>
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
  </v-card>
</template>
<script>
const defaultRules = {
  renege: false,
  all_pass: 'FORCE',
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
    value: {
      type: Object,
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

      rules: Object.assign({}, defaultRules)
    }
  },
  computed: {
    reshuffle: {
      get () {
        return this.rules.all_pass === 'SHUFFLE'
      },
      set (value) {
        this.rules.all_pass = value ? 'SHUFFLE' : 'FORCE'
      }
    }
  },
  watch: {
    value (r) {
      this.rules = r || Object.assign({}, defaultRules)
    },
    rules (r) {
      this.$emit('input', this.rules)
    }
  },
  created () {
    this.$emit('input', this.rules)
  },
  methods: {
    resetRules () {
      this.rules = JSON.parse(JSON.stringify(defaultRules))
    }
  }
}
</script>
