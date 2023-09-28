<template>
  <v-card v-if="list" tile class="pa-3">
    <!-- <div>
      <h2>Rules</h2>
      <v-divider class="my-3" />
    </div> -->
    <div class="d-flex flex-row body-1">
      <div class="d-flex flex-column mr-6">
        <div v-for="r in list.yes" :key="r" class="text-no-wrap">
          <v-icon small color="green" class="mr-1">
            mdi-check
          </v-icon>
          {{ r }}
        </div>
      </div>
      <div class="d-flex flex-column">
        <div v-for="r in list.no" :key="r" class="text-no-wrap">
          <v-icon small color="red" class="mr-1">
            mdi-close
          </v-icon>
          {{ r }}
        </div>
      </div>
    </div>
  </v-card>
</template>
<script>
function decodeRules (rules) {
  const yes = []
  const no = []
  const yn = (exp, text) => {
    if (exp) {
      yes.push(text)
    } else {
      no.push(text)
    }
    return exp
  }
  yn(rules.renege, 'Renege')
  if (rules.all_pass === 'FORCE') {
    yes.push(`Forced minimum bid is ${rules.forced_min_bid}`)
  } else {
    yes.push('Reshuffle')
  }
  yes.push(`Minimum bid is ${rules.min_bid}`)
  yn(rules.follow_me_doubles.includes('HIGH'), 'Follow-me doubles high')
  yn(rules.follow_me_doubles.includes('LOW'), 'Follow-me doubles low')
  yn(rules.follow_me_doubles.includes('HIGH_SUIT'), 'Follow-me doubles high suit')
  yn(rules.follow_me_doubles.includes('LOW_SUIT'), 'Follow-me doubles low suit')
  if (!rules.plunge_allowed) {
    no.push('Plunge')
  } else if (rules.plunge_min_marks === rules.plunge_max_marks) {
    yes.push(`Plunge for ${rules.plunge_min_marks} marks`)
  } else {
    yes.push(`Plunge for ${rules.plunge_min_marks} to ${rules.plunge_max_marks} marks`)
  }
  yn(rules.sevens_allowed, 'Sevens')
  if (rules.nello_allowed === 'NEVER') {
    no.push('Nello')
  } else {
    if (rules.nello_allowed === 'ALWAYS') {
      yes.push('Nello')
    } else {
      yes.push('Nello on forced bid')
    }
    yn(rules.nello_doubles.includes('HIGH'), 'Nello doubles high')
    yn(rules.nello_doubles.includes('LOW'), 'Nello doubles low')
    yn(rules.nello_doubles.includes('HIGH_SUIT'), 'Nello doubles high suit')
    yn(rules.nello_doubles.includes('LOW_SUIT'), 'Nello doubles low suit')
  }
  return { yes, no }
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
    }
  },
  computed: {
    list () {
      return this.value ? decodeRules(this.value) : undefined
    }
  }
}
</script>
