<template>
  <v-sheet
    v-if="value"
    color="#00000000"
    flat
    width="144"
    class="pa-0 ma-0"
  >
    <div v-if="name" class="text-center ma-1" :style="value.bidWinner ? 'color: #0049bd;' : 'color: #6f6f6f;'">
      <v-icon v-if="value.bot" class="mb-2" :color="value.bidWinner ? '#0049bd' : '#6f6f6f'">
        mdi-robot
      </v-icon>
      <span class="text-h6"><strong>{{ value.name }}</strong></span>
    </div>
    <v-sheet height="72" width="144" color="#00000000">
      <v-img v-if="!value.play" height="72" width="144" src="/null.png">
        <v-container fill-height class="pa-0 ma-0">
          <v-row align-center>
            <v-col cols="12" class="text-center">
              <v-progress-circular
                v-if="thinking"
                indeterminate
                size="40"
                :color="value.connected? '#0049bd33' : '#ff360033'"
              />
              <div v-else-if="value.bid && !value.trump">
                <h2 class="black-text">
                  {{ value.bid }}
                </h2>
              </div>
            </v-col>
          </v-row>
        </v-container>
      </v-img>
      <v-img
        v-else
        :src="`/${value.play}.png`"
        contain
        width="144"
        height="72"
      />
    </v-sheet>
  </v-sheet>
</template>
<script>
export default {
  props: {
    // The "status" object
    value: {
      type: Object,
      default: null
    },
    name: {
      type: Boolean,
      default: true
    }
  },

  data () {
    return {
    }
  },

  computed: {
    thinking () {
      return this.value && !this.value.over && (
        !this.value.connected ||
        this.value.waitingForBid ||
        this.value.waitingForTrump ||
        this.value.waitingForPlay)
    },
    winner () {
      return this.value.trickWinner
    }
  },

  watch: {
  },

  created () {
  },

  methods: {
  }
}
</script>
