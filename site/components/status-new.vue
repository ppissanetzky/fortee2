<template>
  <v-card
    v-if="value"
    flat
    width="200"
  >
    <div v-if="name" class="text-center" style="color: #6f6f6f;">
      <h2>{{ value.name }}</h2>
      <v-icon v-if="value.bot">
        mdi-robot
      </v-icon>
    </div>
    <v-card flat color="#dedede" height="80">
      <v-container fill-height>
        <v-row align-center>
          <v-col cols="12" class="text-center">
            <v-progress-circular
              v-if="thinking"
              indeterminate
              size="40"
              color="#0049bd"
            />
            <div v-else-if="value.bid && !value.trump">
              <h2 class="black-text">
                {{ value.bid }}
              </h2>
            </div>
            <div v-else-if="value.play">
              <v-img
                :src="`/${value.play}.png`"
                contain
                max-height="60"
              />
            </div>
          </v-col>
        </v-row>
      </v-container>
    </v-card>
  </v-card>
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
      return this.value && (
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
